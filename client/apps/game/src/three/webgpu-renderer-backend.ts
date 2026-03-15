import type { GraphicsSettings as GraphicsSettingsType } from "@/ui/config";
import { ACESFilmicToneMapping, CineonToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

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
  type RendererFramePipeline,
  type RendererPostProcessController,
  type RendererPostProcessPlan,
} from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";

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
  createRenderer: createDefaultWebGPURenderer,
  now: () => performance.now(),
};

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

const WEBGPU_RENDERER_BACKEND_CAPABILITIES = createRendererBackendCapabilities({
  supportsBloom: false,
  supportsChromaticAberration: false,
  supportsColorGrade: false,
  supportsEnvironmentIbl: false,
  supportsToneMappingControl: false,
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

function resolveRendererToneMapping(mode: RendererPostProcessPlan["toneMapping"]["mode"]): number {
  switch (mode) {
    case "linear":
      return LinearToneMapping;
    case "reinhard":
      return ReinhardToneMapping;
    case "cineon":
      return CineonToneMapping;
    case "aces-filmic":
    case "neutral":
    default:
      // Neutral tone mapping currently depends on the postprocessing stack, which
      // is not wired into the experimental WebGPU backend yet.
      return ACESFilmicToneMapping;
  }
}

export function createWebGPURendererBackend(
  options: {
    graphicsSetting: GraphicsSettingsType;
    isMobileDevice: boolean;
    pixelRatio: number;
    requestedMode: ExperimentalRendererBuildMode;
  },
  dependencies: WebGPURendererBackendDependencies = defaultDependencies,
): RendererBackendV2 {
  let renderer: RendererSurfaceLike | undefined;
  let cleanupDeviceDiagnostics: (() => void) | undefined;

  return {
    capabilities: WEBGPU_RENDERER_BACKEND_CAPABILITIES,
    get renderer() {
      return renderer;
    },
    applyPostProcessPlan(plan) {
      if (!renderer) {
        return NOOP_POST_PROCESS_CONTROLLER;
      }

      renderer.toneMapping = resolveRendererToneMapping(plan.toneMapping.mode);
      renderer.toneMappingExposure = plan.toneMapping.exposure;

      return NOOP_POST_PROCESS_CONTROLLER;
    },
    applyQuality(input) {
      if (!renderer) {
        return;
      }

      renderer.setPixelRatio(input.pixelRatio);
      renderer.shadowMap.enabled = input.shadows;
      renderer.setSize(input.width, input.height);
    },
    dispose() {
      cleanupDeviceDiagnostics?.();
      cleanupDeviceDiagnostics = undefined;
      renderer?.dispose();
      renderer = undefined;
    },
    async initialize() {
      const startTime = dependencies.now();
      const createdRenderer = await dependencies.createRenderer({
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

      if (createdRenderer.activeMode === "webgpu" && createdRenderer.device) {
        markRendererDiagnosticDeviceReady();
      }

      return createRendererInitDiagnostics({
        activeMode: createdRenderer.activeMode,
        buildMode: options.requestedMode,
        initTimeMs: dependencies.now() - startTime,
        requestedMode: options.requestedMode,
      });
    },
    renderFrame(pipeline: RendererFramePipeline) {
      if (!renderer) {
        return;
      }

      renderer.info.reset();
      renderer.clear();
      renderer.render(pipeline.mainScene, pipeline.mainCamera);

      if (pipeline.overlayScene && pipeline.overlayCamera) {
        renderer.clearDepth();
        renderer.render(pipeline.overlayScene, pipeline.overlayCamera);
      }
    },
    resize(width: number, height: number) {
      renderer?.setSize(width, height);
    },
  };
}
