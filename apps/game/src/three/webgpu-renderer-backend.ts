import { configureRendererColorOutput } from "./renderer-color-output";
import { GameMapMaterialLibrary } from "./effects/game-map-material-library";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NeutralToneMapping,
  ReinhardToneMapping,
} from "three";
import { VERBOSE_LOGS_ENABLED, verboseLog } from "@/utils/dev-mode";

import type { RendererSurfaceLike } from "./renderer-backend";
import { markRendererDiagnosticDeviceLost, recordRendererDiagnosticUncapturedError } from "./renderer-diagnostics";
import {
  createRendererBackendCapabilities,
  createRendererInitDiagnostics,
  RendererInitTimeoutError,
  type RendererAdapterInfo,
  type RendererActiveMode,
  type RendererBackendV2,
  type RendererDeviceLostEvent,
  type RendererFramePipeline,
  type RendererFallbackReason,
  type RendererPostProcessController,
  type RendererPostProcessRuntime,
  type RendererPostProcessPlan,
} from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";
import { recordRendererStartupTiming } from "./perf/renderer-startup-telemetry";
import { renderRendererOverlayPasses } from "./renderer-overlay-passes";
import { createWebGPUPostProcessRuntime } from "./webgpu-postprocess-runtime";
import { instrumentGpuBackendHotPaths } from "./gpu-backend-hot-path-instrumentation";

interface WebGPURendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  outputBufferType?: number;
}

interface CreatedWebGPURenderer {
  renderer: WebGPURendererSurface;
}

interface InitializedRendererLane extends CreatedWebGPURenderer {
  activeMode: RendererActiveMode;
  adapterInfo?: RendererAdapterInfo;
  fallbackReason?: RendererFallbackReason;
  device?: WebGPURendererDevice;
  releaseDeviceDiagnostics: () => void;
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
  adapterInfo?: RendererAdapterInfo;
  addEventListener?: (type: "uncapturederror", listener: (event: WebGpuDeviceUncapturedErrorEvent) => void) => void;
  lost?: Promise<WebGpuDeviceLostInfo>;
  removeEventListener?: (type: "uncapturederror", listener: (event: WebGpuDeviceUncapturedErrorEvent) => void) => void;
}

interface WebGPURendererBackendDependencies {
  createPostProcessRuntime(input: { renderer: WebGPURendererSurface }): RendererPostProcessRuntime;
  createRenderer(input: {
    forceWebGL: boolean;
    isMobileDevice: boolean;
    pixelRatio: number;
    signal: AbortSignal;
  }): Promise<CreatedWebGPURenderer>;
  now(): number;
}

interface WebGpuRendererModules {
  threeWebGPUModule: typeof import("three/webgpu");
}

async function createDefaultWebGPURenderer(input: {
  forceWebGL: boolean;
  isMobileDevice: boolean;
  pixelRatio: number;
  signal: AbortSignal;
}): Promise<CreatedWebGPURenderer> {
  const moduleImportStartedAt = performance.now();
  const { threeWebGPUModule } = await loadWebGpuRendererModules(input.signal);
  recordRendererStartupTiming("webgpu-module-import", performance.now() - moduleImportStartedAt);

  const { HalfFloatType, PCFShadowMap, PCFSoftShadowMap, UnsignedByteType, WebGPURenderer } =
    threeWebGPUModule as typeof import("three/webgpu");

  throwIfAborted(input.signal);
  const forceWebGL = input.forceWebGL;
  const rendererCreateStartedAt = performance.now();
  const renderer = new WebGPURenderer({ forceWebGL }) as unknown as WebGPURendererSurface & {
    library: GameMapMaterialLibrary;
  };
  renderer.library = new GameMapMaterialLibrary();

  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = input.isMobileDevice ? PCFShadowMap : PCFSoftShadowMap;
  configureRendererColorOutput(renderer);
  renderer.info.autoReset = false;

  if ("outputBufferType" in renderer) {
    renderer.outputBufferType = input.isMobileDevice ? UnsignedByteType : HalfFloatType;
  }
  recordRendererStartupTiming("webgpu-renderer-create", performance.now() - rendererCreateStartedAt);

  if (import.meta.env.DEV || VERBOSE_LOGS_ENABLED) {
    instrumentWebGpuBackendHotPaths(renderer);
  }

  return {
    renderer,
  };
}

// Method-level attribution remains an explicit debug/logging opt-in so the
// production frame tracker does not add wrapper overhead for ordinary players.
function instrumentWebGpuBackendHotPaths(renderer: WebGPURendererSurface): void {
  const backend = (renderer as unknown as { backend?: Record<string, unknown> }).backend;
  if (backend) {
    instrumentGpuBackendHotPaths(backend);
  }
}

const defaultDependencies: WebGPURendererBackendDependencies = {
  createPostProcessRuntime: createWebGPUPostProcessRuntime,
  createRenderer: createDefaultWebGPURenderer,
  now: () => performance.now(),
};

const ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME = false;
// Native initialization takes under 700 ms in the NVIDIA startup captures after
// removing the animated loading background. Bound a stalled driver.
const WEBGPU_BACKEND_STARTUP_TIMEOUT_MS = 3_200;
// WebGL2 has no fallback behind it. Preserve the previous ceiling as a last-resort
// stall detector instead of turning ordinary slow starts into hard bootstrap failures.
const WEBGL2_BACKEND_STARTUP_TIMEOUT_MS = 15_000;
let webGpuFrameRecoveryWarned = false;
let webGpuRendererModulesPromise: Promise<WebGpuRendererModules> | null = null;

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

const WEBGPU_RENDERER_BACKEND_CAPABILITIES = createRendererBackendCapabilities({
  supportsBloom: false,
  supportsChromaticAberration: false,
  supportsColorGrade: false,
  supportsEnvironmentIbl: false,
  supportsToneMappingControl: true,
  supportsVignette: false,
  supportsWideLines: false,
});

async function importWebGpuRendererModules(): Promise<WebGpuRendererModules> {
  // Let the real renderer request its adapter once; do not import the capability addon
  // whose top-level adapter await can block module evaluation.
  const threeWebGPUModule = await import("three/webgpu");
  return { threeWebGPUModule: threeWebGPUModule as typeof import("three/webgpu") };
}

async function loadWebGpuRendererModules(signal?: AbortSignal): Promise<WebGpuRendererModules> {
  throwIfAborted(signal);
  if (!webGpuRendererModulesPromise) {
    webGpuRendererModulesPromise = importWebGpuRendererModules().catch((error) => {
      webGpuRendererModulesPromise = null;
      throw error;
    });
  }

  const modules = await webGpuRendererModulesPromise;
  throwIfAborted(signal);
  return modules;
}

/** Which backend three actually built; debug renderers report it instead of re-asking the browser. */
export function resolveWebGpuRendererActiveMode(renderer: unknown): RendererActiveMode {
  const backend = (renderer as { backend?: { isWebGPUBackend?: boolean } }).backend;
  return backend?.isWebGPUBackend ? "webgpu" : "webgl2-fallback";
}

export function preloadWebGpuRendererModules(): void {
  void loadWebGpuRendererModules().catch(() => {
    // A later real renderer init will retry because the cached promise resets on failure.
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw signal.reason;
}

function createWebGpuStartupTimeoutError(
  timeoutMs: number,
  timedOutMode: RendererActiveMode | null = null,
): RendererInitTimeoutError {
  return new RendererInitTimeoutError(`Renderer startup timed out after ${timeoutMs}ms`, timedOutMode);
}

function resolveWebGpuInitFailureReason(error: unknown): Exclude<RendererFallbackReason, null> {
  if (error instanceof RendererInitTimeoutError) {
    return "webgpu-init-timeout";
  }

  const errorClass = error instanceof Error && error.name ? error.name : "UnknownError";
  return `webgpu-init-error:${errorClass}`;
}

function resolveWebGpuRendererDevice(renderer: WebGPURendererSurface): WebGPURendererDevice | undefined {
  const rendererWithBackend = renderer as WebGPURendererSurface & {
    backend?: {
      device?: WebGPURendererDevice;
    };
  };

  return rendererWithBackend.backend?.device;
}

function resolveWebGpuAdapterInfo(device?: WebGPURendererDevice): RendererAdapterInfo | undefined {
  const adapterInfo = device?.adapterInfo;
  if (!adapterInfo) {
    return undefined;
  }

  return {
    architecture: adapterInfo.architecture ?? "",
    description: adapterInfo.description ?? "",
    isFallbackAdapter: adapterInfo.isFallbackAdapter,
    vendor: adapterInfo.vendor ?? "",
  };
}

function attachWebGpuDeviceDiagnostics(input: {
  device?: WebGPURendererDevice;
  onDeviceLost?: (event: RendererDeviceLostEvent) => void;
}): () => void {
  if (!input.device) {
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
    input.onDeviceLost?.({
      activeMode: "webgpu",
      message: info.message,
    });
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
    case "neutral":
      return NeutralToneMapping;
    case "aces-filmic":
    default:
      return ACESFilmicToneMapping;
  }
}

function isRecoverableWebGpuFrameError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }

  return error.message.includes("depthTexture");
}

function logRecoverableWebGpuFrameError(error: TypeError): void {
  if (webGpuFrameRecoveryWarned) {
    return;
  }

  webGpuFrameRecoveryWarned = true;
  console.warn("[WebGPURendererBackend] Recovered from a transient WebGPU frame failure", error);
}

async function waitForWebGpuBackendStartup(input: {
  abortController: AbortController;
  clearTimeoutFn?: typeof clearTimeout;
  disposeCreatedRenderer: () => void;
  resolveTimedOutMode: () => RendererActiveMode | null;
  setTimeoutFn?: typeof setTimeout;
  startupPromise: Promise<InitializedRendererLane>;
  timeoutMs: number;
}): Promise<InitializedRendererLane> {
  const setTimeoutFn = input.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = input.clearTimeoutFn ?? clearTimeout;
  let timeoutError: RendererInitTimeoutError | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const guardedStartupPromise = input.startupPromise.then((lane) => {
    if (timeoutError) {
      input.disposeCreatedRenderer();
      throw timeoutError;
    }

    return lane;
  });
  void guardedStartupPromise.catch(() => {
    // The race may already have rejected on timeout. Keep late async failures contained.
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeoutFn(() => {
      timeoutError = createWebGpuStartupTimeoutError(input.timeoutMs, input.resolveTimedOutMode());
      input.abortController.abort(timeoutError);
      input.disposeCreatedRenderer();
      reject(timeoutError);
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([guardedStartupPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeoutFn(timeoutId);
    }
  }
}

function renderMainFrameWithRecovery(renderer: RendererSurfaceLike, pipeline: RendererFramePipeline): void {
  renderer.info.reset();

  try {
    renderClearedMainScene(renderer, pipeline);
    return;
  } catch (error) {
    if (!isRecoverableWebGpuFrameError(error)) {
      throw error;
    }

    recordRendererDiagnosticUncapturedError((error as TypeError).message);
    logRecoverableWebGpuFrameError(error as TypeError);
    renderer.setSize(window.innerWidth, window.innerHeight);

    try {
      renderClearedMainScene(renderer, pipeline);
    } catch (retryError) {
      recordRendererDiagnosticUncapturedError(retryError instanceof Error ? retryError.message : String(retryError));
    }
  }
}

function renderClearedMainScene(renderer: RendererSurfaceLike, pipeline: RendererFramePipeline): void {
  const previousAutoClear = renderer.autoClear;
  // A manual clear also presents Three.js's output target. Clear inside the main
  // render pass instead, then restore the overlay policy even when rendering fails.
  renderer.autoClear = true;
  try {
    renderer.render(pipeline.mainScene, pipeline.mainCamera);
  } finally {
    renderer.autoClear = previousAutoClear;
  }
}

export function createWebGPURendererBackend(
  options: {
    isMobileDevice: boolean;
    onDeviceLost?: (event: RendererDeviceLostEvent) => void;
    pixelRatio: number;
    requestedMode: RendererBuildMode;
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
  let disposed = false;

  const startRendererLane = async (forceWebGL: boolean): Promise<InitializedRendererLane> => {
    const startupTimeoutMs = forceWebGL ? WEBGL2_BACKEND_STARTUP_TIMEOUT_MS : WEBGPU_BACKEND_STARTUP_TIMEOUT_MS;
    const abortController = new AbortController();
    let createdRenderer: CreatedWebGPURenderer | undefined;
    let releaseDeviceDiagnostics: (() => void) | undefined;
    const disposeCreatedRenderer = () => {
      releaseDeviceDiagnostics?.();
      releaseDeviceDiagnostics = undefined;
      createdRenderer?.renderer.dispose();
      createdRenderer = undefined;
    };

    const startupPromise = (async (): Promise<InitializedRendererLane> => {
      createdRenderer = await resolvedDependencies.createRenderer({
        forceWebGL,
        isMobileDevice: options.isMobileDevice,
        pixelRatio: options.pixelRatio,
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        disposeCreatedRenderer();
        throwIfAborted(abortController.signal);
      }

      try {
        createdRenderer.renderer.setPixelRatio(options.pixelRatio);
        createdRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
        const rendererInitStartedAt = resolvedDependencies.now();
        const initializingRenderer = createdRenderer.renderer;
        try {
          await initializingRenderer.init();
        } finally {
          // Adapter/device requests cannot be cancelled. Dispose again if init creates
          // GPU resources after the timeout already disposed the incomplete renderer.
          if (abortController.signal.aborted) initializingRenderer.dispose();
        }
        throwIfAborted(abortController.signal);
        recordRendererStartupTiming("webgpu-renderer-init", resolvedDependencies.now() - rendererInitStartedAt);

        const activeMode = resolveWebGpuRendererActiveMode(createdRenderer.renderer);
        const device = activeMode === "webgpu" ? resolveWebGpuRendererDevice(createdRenderer.renderer) : undefined;
        const adapterInfo = resolveWebGpuAdapterInfo(device);
        releaseDeviceDiagnostics = attachWebGpuDeviceDiagnostics({ device, onDeviceLost: options.onDeviceLost });
        return { ...createdRenderer, activeMode, adapterInfo, device, releaseDeviceDiagnostics };
      } catch (error) {
        disposeCreatedRenderer();
        throw error;
      }
    })();

    return waitForWebGpuBackendStartup({
      abortController,
      disposeCreatedRenderer,
      resolveTimedOutMode: () => (forceWebGL ? "webgl2-fallback" : "webgpu"),
      startupPromise,
      timeoutMs: startupTimeoutMs,
    });
  };

  const startRendererLaneWithWebGlFallback = async (): Promise<InitializedRendererLane> => {
    const forceWebGL = options.requestedMode === "webgpu-force-webgl";
    try {
      const lane = await startRendererLane(forceWebGL);
      if (lane.activeMode === "webgpu") {
        return { ...lane, fallbackReason: null };
      }

      if (!forceWebGL) {
        return { ...lane, fallbackReason: "webgpu-silent-fallback" };
      }

      return { ...lane, fallbackReason: null };
    } catch (error) {
      if (forceWebGL) {
        throw error;
      }

      const fallbackReason = resolveWebGpuInitFailureReason(error);
      console.warn(`[WebGPURendererBackend] WebGPU init failed (${fallbackReason}); continuing on WebGL2`);
      verboseLog("[RendererDebug]", {
        error,
        event: "webgpu-init-failed",
        fallbackReason,
      });
      return { ...(await startRendererLane(true)), fallbackReason };
    }
  };

  return {
    capabilities: WEBGPU_RENDERER_BACKEND_CAPABILITIES,
    get renderer() {
      return renderer;
    },
    applyPostProcessPlan(plan) {
      if (!postProcessRuntime) {
        if (!renderer) {
          return NOOP_POST_PROCESS_CONTROLLER;
        }

        renderer.toneMapping = resolveRendererToneMapping(plan.toneMapping.mode);
        renderer.toneMappingExposure = plan.toneMapping.exposure;
        return NOOP_POST_PROCESS_CONTROLLER;
      }

      return postProcessRuntime.setPlan(plan);
    },
    applyRenderVisuals(input) {
      if (!renderer) {
        return;
      }

      renderer.setPixelRatio(input.pixelRatio);
      renderer.shadowMap.enabled = input.shadows;
      renderer.setSize(input.width, input.height);
      if (ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME) {
        postProcessRuntime?.setSize(input.width, input.height);
      }
    },
    dispose() {
      disposed = true;
      cleanupDeviceDiagnostics?.();
      cleanupDeviceDiagnostics = undefined;
      if (ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME) {
        postProcessRuntime?.dispose();
        postProcessRuntime = undefined;
      }
      renderer?.dispose();
      renderer = undefined;
    },
    async initialize() {
      const startTime = resolvedDependencies.now();

      try {
        const lane = await startRendererLaneWithWebGlFallback();
        cleanupDeviceDiagnostics?.();
        cleanupDeviceDiagnostics = lane.releaseDeviceDiagnostics;
        renderer = lane.renderer;
        if (ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME) {
          postProcessRuntime = resolvedDependencies.createPostProcessRuntime({ renderer: lane.renderer });
        }

        return createRendererInitDiagnostics({
          activeMode: lane.activeMode,
          adapterInfo: lane.adapterInfo,
          buildMode: options.requestedMode,
          deviceStatus: lane.activeMode === "webgpu" && lane.device ? "ready" : undefined,
          fallbackReason: lane.fallbackReason,
          initTimeMs: resolvedDependencies.now() - startTime,
          requestedMode: options.requestedMode,
        });
      } finally {
        recordRendererStartupTiming("webgpu-backend-total", resolvedDependencies.now() - startTime);
      }
    },
    renderFrame(pipeline: RendererFramePipeline) {
      if (!ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME || !postProcessRuntime) {
        if (!renderer) {
          return;
        }

        renderMainFrameWithRecovery(renderer, pipeline);
        renderRendererOverlayPasses(renderer, pipeline);
        return;
      }

      postProcessRuntime.renderFrame(pipeline);
    },
    resize(width: number, height: number) {
      renderer?.setSize(width, height);
      if (ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME) {
        postProcessRuntime?.setSize(width, height);
      }
    },
  };
}
