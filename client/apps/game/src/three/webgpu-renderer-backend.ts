import type { GraphicsSettings as GraphicsSettingsType } from "@/ui/config";
import { ACESFilmicToneMapping } from "three";

import type { RendererSurfaceLike } from "./renderer-backend";
import {
  markRendererDiagnosticDeviceLost,
  markRendererDiagnosticDeviceReady,
  recordRendererDiagnosticUncapturedError,
} from "./renderer-diagnostics";
import {
  createRendererBackendCapabilities,
  createRendererInitDiagnostics,
  type RendererActiveMode,
  type RendererBackendV2,
  type RendererPostProcessController,
  type RendererPostProcessRuntime,
} from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";
import { createWebGPUPostProcessRuntime } from "./webgpu-postprocess-runtime";

type ExperimentalRendererBuildMode = Exclude<RendererBuildMode, "legacy-webgl">;

interface WebGPURendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  outputBufferType?: number;
}

interface CreatedWebGPURenderer {
  activeMode: RendererActiveMode;
  device?: WebGPURendererDevice;
  renderer: WebGPURendererSurface;
}

interface WebGpuDeviceLostInfo {
  message?: string;
}

interface WebGpuDeviceUncapturedErrorEvent {
  error?: {
    message?: string;
  };
}

interface WebGPURendererDevice {
  addEventListener?: (type: "uncapturederror", listener: (event: WebGpuDeviceUncapturedErrorEvent) => void) => void;
  lost?: Promise<WebGpuDeviceLostInfo>;
  removeEventListener?: (type: "uncapturederror", listener: (event: WebGpuDeviceUncapturedErrorEvent) => void) => void;
}

interface WebGPURendererBackendDependencies {
  createPostProcessRuntime(input: { renderer: WebGPURendererSurface }): RendererPostProcessRuntime;
  createRenderer(input: {
    forceWebGL: boolean;
    graphicsSetting: GraphicsSettingsType;
    isMobileDevice: boolean;
    pixelRatio: number;
  }): Promise<CreatedWebGPURenderer>;
  now(): number;
}

async function createDefaultWebGPURenderer(input: {
  forceWebGL: boolean;
  graphicsSetting: GraphicsSettingsType;
  isMobileDevice: boolean;
  pixelRatio: number;
}): Promise<CreatedWebGPURenderer> {
  const [{ default: WebGPU }, threeWebGPUModule] = await Promise.all([
    import("three/addons/capabilities/WebGPU.js"),
    import("three/webgpu"),
  ]);

  const {
    ACESFilmicToneMapping,
    HalfFloatType,
    PCFShadowMap,
    PCFSoftShadowMap,
    UnsignedByteType,
    WebGPURenderer,
  } = threeWebGPUModule as typeof import("three/webgpu");

  const renderer = new WebGPURenderer({
    antialias: false,
    forceWebGL: input.forceWebGL,
    powerPreference: "high-performance",
  }) as WebGPURendererSurface;

  renderer.setPixelRatio(input.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  renderer.shadowMap.enabled = input.graphicsSetting !== "LOW";
  renderer.shadowMap.type = input.isMobileDevice ? PCFShadowMap : PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.info.autoReset = false;

  if ("outputBufferType" in renderer) {
    renderer.outputBufferType = input.isMobileDevice ? UnsignedByteType : HalfFloatType;
  }

  return {
    activeMode: input.forceWebGL || !WebGPU.isAvailable() ? "webgl2-fallback" : "webgpu",
    device: resolveWebGpuRendererDevice(renderer),
    renderer,
  };
}

const defaultDependencies: WebGPURendererBackendDependencies = {
  createPostProcessRuntime: createWebGPUPostProcessRuntime,
  createRenderer: createDefaultWebGPURenderer,
  now: () => performance.now(),
};

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

const WEBGPU_RENDERER_BACKEND_CAPABILITIES = createRendererBackendCapabilities({
  supportsBloom: true,
  supportsChromaticAberration: false,
  supportsColorGrade: false,
  supportsEnvironmentIbl: false,
  supportsToneMappingControl: true,
  supportsVignette: false,
  supportsWideLines: false,
});

function resolveWebGpuRendererDevice(renderer: WebGPURendererSurface): WebGPURendererDevice | undefined {
  const rendererWithBackend = renderer as WebGPURendererSurface & {
    backend?: {
      device?: WebGPURendererDevice;
    };
  };

  return rendererWithBackend.backend?.device;
}

function attachWebGpuDeviceDiagnostics(input: {
  activeMode: RendererActiveMode;
  device?: WebGPURendererDevice;
}): () => void {
  if (input.activeMode !== "webgpu" || !input.device) {
    return () => {};
  }

  let disposed = false;
  const handleUncapturedError = (event: WebGpuDeviceUncapturedErrorEvent) => {
    if (disposed) {
      return;
    }

    recordRendererDiagnosticUncapturedError(event.error?.message);
  };

  input.device.addEventListener?.("uncapturederror", handleUncapturedError);
  void input.device.lost?.then((info) => {
    if (disposed) {
      return;
    }

    markRendererDiagnosticDeviceLost(info.message);
  });

  return () => {
    disposed = true;
    input.device?.removeEventListener?.("uncapturederror", handleUncapturedError);
  };
}

export function createWebGPURendererBackend(
  options: {
    graphicsSetting: GraphicsSettingsType;
    isMobileDevice: boolean;
    pixelRatio: number;
    requestedMode: ExperimentalRendererBuildMode;
  },
  dependencies: Partial<WebGPURendererBackendDependencies> = defaultDependencies,
): RendererBackendV2 {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies,
  } satisfies WebGPURendererBackendDependencies;
  let renderer: RendererSurfaceLike | undefined;
  let postProcessRuntime: RendererPostProcessRuntime | undefined;
  let cleanupDeviceDiagnostics: (() => void) | undefined;

  return {
    capabilities: WEBGPU_RENDERER_BACKEND_CAPABILITIES,
    get renderer() {
      return renderer;
    },
    applyPostProcessPlan(plan) {
      if (!postProcessRuntime) {
        return NOOP_POST_PROCESS_CONTROLLER;
      }

      return postProcessRuntime.setPlan(plan);
    },
    applyQuality(input) {
      if (!renderer) {
        return;
      }

      renderer.setPixelRatio(input.pixelRatio);
      renderer.shadowMap.enabled = input.shadows;
      renderer.setSize(input.width, input.height);
      postProcessRuntime?.setSize(input.width, input.height);
    },
    dispose() {
      cleanupDeviceDiagnostics?.();
      cleanupDeviceDiagnostics = undefined;
      postProcessRuntime?.dispose();
      postProcessRuntime = undefined;
      renderer?.dispose();
      renderer = undefined;
    },
    async initialize() {
      const startTime = resolvedDependencies.now();
      const createdRenderer = await resolvedDependencies.createRenderer({
        forceWebGL: options.requestedMode === "experimental-webgpu-force-webgl",
        graphicsSetting: options.graphicsSetting,
        isMobileDevice: options.isMobileDevice,
        pixelRatio: options.pixelRatio,
      });
      const releaseDeviceDiagnostics = attachWebGpuDeviceDiagnostics({
        activeMode: createdRenderer.activeMode,
        device: createdRenderer.device,
      });

      try {
        createdRenderer.renderer.setPixelRatio(options.pixelRatio);
        createdRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
        await createdRenderer.renderer.init();
      } catch (error) {
        releaseDeviceDiagnostics();
        createdRenderer.renderer.dispose();
        throw error;
      }

      cleanupDeviceDiagnostics?.();
      cleanupDeviceDiagnostics = releaseDeviceDiagnostics;
      renderer = createdRenderer.renderer;
      postProcessRuntime = resolvedDependencies.createPostProcessRuntime({
        renderer: createdRenderer.renderer,
      });

      if (createdRenderer.activeMode === "webgpu" && createdRenderer.device) {
        markRendererDiagnosticDeviceReady();
      }

      return createRendererInitDiagnostics({
        activeMode: createdRenderer.activeMode,
        buildMode: options.requestedMode,
        initTimeMs: resolvedDependencies.now() - startTime,
        requestedMode: options.requestedMode,
      });
    },
    renderFrame(pipeline) {
      if (!postProcessRuntime) {
        return;
      }

      postProcessRuntime.renderFrame(pipeline);
    },
    resize(width: number, height: number) {
      renderer?.setSize(width, height);
      postProcessRuntime?.setSize(width, height);
    },
  };
}
