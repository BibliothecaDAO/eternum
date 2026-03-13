import type { GraphicsSettings as GraphicsSettingsType } from "@/ui/config";

import type { RendererSurfaceLike } from "./renderer-backend";
import {
  createRendererInitDiagnostics,
  type RendererActiveMode,
  type RendererBackendV2,
} from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";

type ExperimentalRendererBuildMode = Exclude<RendererBuildMode, "legacy-webgl">;

interface WebGPURendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  outputBufferType?: number;
}

interface CreatedWebGPURenderer {
  activeMode: RendererActiveMode;
  renderer: WebGPURendererSurface;
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
    renderer,
  };
}

const defaultDependencies: WebGPURendererBackendDependencies = {
  createRenderer: createDefaultWebGPURenderer,
  now: () => performance.now(),
};

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

  return {
    get renderer() {
      return renderer;
    },
    async initialize() {
      const startTime = dependencies.now();
      const createdRenderer = await dependencies.createRenderer({
        forceWebGL: options.requestedMode === "experimental-webgpu-force-webgl",
        graphicsSetting: options.graphicsSetting,
        isMobileDevice: options.isMobileDevice,
        pixelRatio: options.pixelRatio,
      });

      createdRenderer.renderer.setPixelRatio(options.pixelRatio);
      createdRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
      await createdRenderer.renderer.init();
      renderer = createdRenderer.renderer;

      return createRendererInitDiagnostics({
        activeMode: createdRenderer.activeMode,
        buildMode: options.requestedMode,
        initTimeMs: dependencies.now() - startTime,
        requestedMode: options.requestedMode,
      });
    },
  };
}
