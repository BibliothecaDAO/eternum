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

interface WebGPURendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  outputBufferType?: number;
}

interface CreatedWebGPURenderer {
  activeMode: RendererActiveMode;
  fallbackReason?: RendererFallbackReason;
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
    isMobileDevice: boolean;
    pixelRatio: number;
    signal: AbortSignal;
  }): Promise<CreatedWebGPURenderer>;
  now(): number;
}

interface WebGpuRendererModules {
  WebGPU: {
    isAvailable(): boolean;
  };
  threeWebGPUModule: typeof import("three/webgpu");
}

async function createDefaultWebGPURenderer(input: {
  forceWebGL: boolean;
  isMobileDevice: boolean;
  pixelRatio: number;
  signal: AbortSignal;
}): Promise<CreatedWebGPURenderer> {
  const moduleImportStartedAt = performance.now();
  const { WebGPU, threeWebGPUModule } = await loadWebGpuRendererModules(input.signal);
  recordRendererStartupTiming("webgpu-module-import", performance.now() - moduleImportStartedAt);

  const { ACESFilmicToneMapping, HalfFloatType, PCFShadowMap, PCFSoftShadowMap, UnsignedByteType, WebGPURenderer } =
    threeWebGPUModule as typeof import("three/webgpu");

  throwIfAborted(input.signal);
  const rendererCreateStartedAt = performance.now();
  const renderer = new WebGPURenderer({
    forceWebGL: input.forceWebGL,
  }) as WebGPURendererSurface;

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

  const webGpuAvailable = WebGPU.isAvailable();
  return {
    activeMode: input.forceWebGL || !webGpuAvailable ? "webgl2-fallback" : "webgpu",
    fallbackReason: !input.forceWebGL && !webGpuAvailable ? "webgpu-unavailable" : null,
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
const WEBGPU_BACKEND_STARTUP_TIMEOUT_MS = 15_000;
const WEBGPU_RENDERER_INIT_TIMEOUT_MS = 12_000;
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
  const [{ default: WebGPU }, threeWebGPUModule] = await Promise.all([
    import("three/addons/capabilities/WebGPU.js"),
    import("three/webgpu"),
  ]);

  return {
    WebGPU,
    threeWebGPUModule: threeWebGPUModule as typeof import("three/webgpu"),
  };
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

function createWebGpuStartupTimeoutError(timeoutMs: number): RendererInitTimeoutError {
  return new RendererInitTimeoutError(`Experimental renderer startup timed out after ${timeoutMs}ms`);
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

async function waitForRendererInitialization(
  renderer: WebGPURendererSurface,
  timeoutMs: number,
  setTimeoutFn: typeof setTimeout = setTimeout,
  clearTimeoutFn: typeof clearTimeout = clearTimeout,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const initPromise = renderer.init().catch((error) => {
    throw error;
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeoutFn(() => {
      reject(new RendererInitTimeoutError(`WebGPU renderer init timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([initPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeoutFn(timeoutId);
    }
  }
}

async function waitForWebGpuBackendStartup(input: {
  abortController: AbortController;
  clearTimeoutFn?: typeof clearTimeout;
  disposeCreatedRenderer: () => void;
  setTimeoutFn?: typeof setTimeout;
  startupPromise: Promise<CreatedWebGPURenderer>;
  timeoutMs: number;
}): Promise<CreatedWebGPURenderer> {
  const setTimeoutFn = input.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = input.clearTimeoutFn ?? clearTimeout;
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = createWebGpuStartupTimeoutError(input.timeoutMs);
  const guardedStartupPromise = input.startupPromise.then((createdRenderer) => {
    if (timedOut) {
      input.disposeCreatedRenderer();
      throw timeoutError;
    }

    return createdRenderer;
  });
  void guardedStartupPromise.catch(() => {
    // The race may already have rejected on timeout. Keep late async failures contained.
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeoutFn(() => {
      timedOut = true;
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
      const abortController = new AbortController();
      let createdRenderer: CreatedWebGPURenderer | undefined;
      let initializedDevice: WebGPURendererDevice | undefined;
      let releaseDeviceDiagnostics: (() => void) | undefined;
      const disposeCreatedRenderer = () => {
        releaseDeviceDiagnostics?.();
        releaseDeviceDiagnostics = undefined;
        createdRenderer?.renderer.dispose();
        createdRenderer = undefined;
      };

      try {
        const startupPromise = (async () => {
          createdRenderer = await resolvedDependencies.createRenderer({
            forceWebGL: options.requestedMode === "webgpu-force-webgl",
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
            await waitForRendererInitialization(createdRenderer.renderer, WEBGPU_RENDERER_INIT_TIMEOUT_MS);
            if (abortController.signal.aborted) {
              throw createWebGpuStartupTimeoutError(WEBGPU_BACKEND_STARTUP_TIMEOUT_MS);
            }
            recordRendererStartupTiming("webgpu-renderer-init", resolvedDependencies.now() - rendererInitStartedAt);

            initializedDevice = resolveWebGpuRendererDevice(createdRenderer.renderer);
            releaseDeviceDiagnostics = attachWebGpuDeviceDiagnostics({
              device: initializedDevice,
              onDeviceLost: options.onDeviceLost,
            });
          } catch (error) {
            disposeCreatedRenderer();
            throw error;
          }

          return createdRenderer;
        })();

        const initializedRenderer = await waitForWebGpuBackendStartup({
          abortController,
          disposeCreatedRenderer,
          startupPromise,
          timeoutMs: WEBGPU_BACKEND_STARTUP_TIMEOUT_MS,
        });

        cleanupDeviceDiagnostics?.();
        cleanupDeviceDiagnostics = releaseDeviceDiagnostics;
        renderer = initializedRenderer.renderer;
        if (ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME) {
          postProcessRuntime = resolvedDependencies.createPostProcessRuntime({
            renderer: initializedRenderer.renderer,
          });
        }

        return createRendererInitDiagnostics({
          activeMode: initializedRenderer.activeMode,
          buildMode: options.requestedMode,
          deviceStatus: initializedRenderer.activeMode === "webgpu" && initializedDevice ? "ready" : undefined,
          fallbackReason: initializedRenderer.fallbackReason,
          initTimeMs: resolvedDependencies.now() - startTime,
          requestedMode: options.requestedMode,
        });
      } finally {
        const totalDurationMs = resolvedDependencies.now() - startTime;
        recordRendererStartupTiming("webgpu-backend-total", totalDurationMs);
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
