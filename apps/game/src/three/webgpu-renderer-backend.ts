import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NeutralToneMapping,
  ReinhardToneMapping,
} from "three";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";

import type { RendererSurfaceLike } from "./renderer-backend";
import { markRendererDiagnosticDeviceLost, recordRendererDiagnosticUncapturedError } from "./renderer-diagnostics";
import {
  createRendererBackendCapabilities,
  createRendererInitDiagnostics,
  RendererInitTimeoutError,
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
import {
  probeWebGpuAdapter,
  rememberRendererLane,
  resolveWebGpuLaneStart,
  type RendererLane,
  type WebGpuLaneStart,
} from "./webgpu-lane-probe";

interface WebGPURendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  outputBufferType?: number;
}

interface CreatedWebGPURenderer {
  activeMode: RendererActiveMode;
  fallbackReason?: RendererFallbackReason;
  renderer: WebGPURendererSurface;
}

interface InitializedRendererLane extends CreatedWebGPURenderer {
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
  /** Remembers the lane that actually started, so the next boot on this profile skips the question. */
  rememberLane(lane: RendererLane, reason: string): void;
  /** Decides whether to try WebGPU at all — bounded probe or per-profile memory, never an unbounded adapter wait. */
  resolveLaneStart(input: { forceReprobe: boolean; requestedMode: RendererBuildMode }): Promise<WebGpuLaneStart>;
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

  const { ACESFilmicToneMapping, HalfFloatType, PCFShadowMap, PCFSoftShadowMap, UnsignedByteType, WebGPURenderer } =
    threeWebGPUModule as typeof import("three/webgpu");

  throwIfAborted(input.signal);
  const forceWebGL = input.forceWebGL;
  const rendererCreateStartedAt = performance.now();
  const renderer = new WebGPURenderer({ forceWebGL }) as WebGPURendererSurface;

  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = input.isMobileDevice ? PCFShadowMap : PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.info.autoReset = false;

  if ("outputBufferType" in renderer) {
    renderer.outputBufferType = input.isMobileDevice ? UnsignedByteType : HalfFloatType;
  }
  recordRendererStartupTiming("webgpu-renderer-create", performance.now() - rendererCreateStartedAt);

  if (import.meta.env.DEV || VERBOSE_LOGS_ENABLED) {
    instrumentWebGpuBackendHotPaths(renderer);
  }

  return {
    activeMode: forceWebGL ? "webgl2-fallback" : "webgpu",
    fallbackReason: null,
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
  rememberLane: (lane, reason) => rememberRendererLane(resolveLaneStorage(), lane, reason),
  resolveLaneStart: (input) =>
    resolveWebGpuLaneStart({
      ...input,
      probe: () => probeWebGpuAdapter({ gpu: resolveNavigatorGpu() }),
      storage: resolveLaneStorage(),
    }),
};

function resolveNavigatorGpu(): { requestAdapter(): Promise<unknown | null> } | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
}

function resolveLaneStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME = false;
const WEBGPU_BACKEND_STARTUP_TIMEOUT_MS = 15_000;
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
  // Only three's renderer module: the capability addon's top-level adapter await is replaced by the bounded probe.
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

  throw createWebGpuStartupTimeoutError(WEBGPU_BACKEND_STARTUP_TIMEOUT_MS);
}

function createWebGpuStartupTimeoutError(
  timeoutMs: number,
  timedOutMode: RendererActiveMode | null = null,
): RendererInitTimeoutError {
  return new RendererInitTimeoutError(`Renderer startup timed out after ${timeoutMs}ms`, timedOutMode);
}

function isStalledWebGpuLane(error: unknown): boolean {
  return error instanceof RendererInitTimeoutError && error.timedOutMode === "webgpu";
}

function resolveWebGpuRendererDevice(renderer: WebGPURendererSurface): WebGPURendererDevice | undefined {
  const rendererWithBackend = renderer as WebGPURendererSurface & {
    backend?: {
      device?: WebGPURendererDevice;
    };
  };

  return rendererWithBackend.backend?.device;
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
      input.abortController.abort();
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
  renderer.clear();

  try {
    renderer.render(pipeline.mainScene, pipeline.mainCamera);
    return;
  } catch (error) {
    if (!isRecoverableWebGpuFrameError(error)) {
      throw error;
    }

    recordRendererDiagnosticUncapturedError((error as TypeError).message);
    logRecoverableWebGpuFrameError(error as TypeError);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.clear();

    try {
      renderer.render(pipeline.mainScene, pipeline.mainCamera);
    } catch (retryError) {
      recordRendererDiagnosticUncapturedError(retryError instanceof Error ? retryError.message : String(retryError));
    }
  }
}

export function createWebGPURendererBackend(
  options: {
    isMobileDevice: boolean;
    onDeviceLost?: (event: RendererDeviceLostEvent) => void;
    pixelRatio: number;
    requestedMode: RendererBuildMode;
    /** An explicit `?rendererMode=` re-probes instead of trusting the remembered lane. */
    forceReprobe?: boolean;
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
        throw createWebGpuStartupTimeoutError(WEBGPU_BACKEND_STARTUP_TIMEOUT_MS);
      }

      try {
        createdRenderer.renderer.setPixelRatio(options.pixelRatio);
        createdRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
        const rendererInitStartedAt = resolvedDependencies.now();
        await createdRenderer.renderer.init();
        if (abortController.signal.aborted) {
          throw createWebGpuStartupTimeoutError(WEBGPU_BACKEND_STARTUP_TIMEOUT_MS, createdRenderer.activeMode);
        }
        recordRendererStartupTiming("webgpu-renderer-init", resolvedDependencies.now() - rendererInitStartedAt);

        const device = resolveWebGpuRendererDevice(createdRenderer.renderer);
        releaseDeviceDiagnostics = attachWebGpuDeviceDiagnostics({ device, onDeviceLost: options.onDeviceLost });
        return { ...createdRenderer, device, releaseDeviceDiagnostics };
      } catch (error) {
        disposeCreatedRenderer();
        throw error;
      }
    })();

    return waitForWebGpuBackendStartup({
      abortController,
      disposeCreatedRenderer,
      resolveTimedOutMode: () => createdRenderer?.activeMode ?? null,
      startupPromise,
      timeoutMs: WEBGPU_BACKEND_STARTUP_TIMEOUT_MS,
    });
  };

  const startRendererLaneWithWebGlFallback = async (): Promise<InitializedRendererLane> => {
    const start = await resolvedDependencies.resolveLaneStart({
      forceReprobe: options.forceReprobe ?? false,
      requestedMode: options.requestedMode,
    });
    try {
      const lane = await startRendererLane(start.forceWebGL);
      if (lane.activeMode === "webgpu") resolvedDependencies.rememberLane("webgpu", "init");
      return { ...lane, fallbackReason: lane.fallbackReason ?? start.fallbackReason };
    } catch (error) {
      if (!isStalledWebGpuLane(error)) {
        throw error;
      }

      // A WebGPU init that never answers is the browser's stall (a saturated GPU process,
      // adapter probing), not a scene problem: WebGL2 is the lane that still renders — and this
      // profile does not ask again.
      console.warn(
        `[WebGPURendererBackend] WebGPU init stalled for ${WEBGPU_BACKEND_STARTUP_TIMEOUT_MS}ms; continuing on WebGL2`,
      );
      resolvedDependencies.rememberLane("webgl2", "webgpu-init-timeout");
      return { ...(await startRendererLane(true)), fallbackReason: "webgpu-init-timeout" };
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
