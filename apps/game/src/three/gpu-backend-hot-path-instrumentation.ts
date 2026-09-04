import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import { consumeDominantFrameWorkOwner, type DominantFrameWorkOwner } from "./frame-work-owner";
import { getRendererDiagnosticActiveMode } from "./renderer-diagnostics";

interface InstrumentedTexture {
  image?: TextureImage;
  name?: string;
  source?: { data?: TextureImage };
  uuid?: string;
}

interface TextureImage {
  depth?: number;
  height?: number;
  naturalHeight?: number;
  naturalWidth?: number;
  videoHeight?: number;
  videoWidth?: number;
  width?: number;
}

interface HotPathStat {
  accumulatedMs: number;
  calls: number;
}

interface TextureHotPathStat extends HotPathStat {
  dimensions: string;
  name: string;
}

interface ActiveGpuBackendFrame {
  gpuAttributionEnabled: boolean;
  hotPathStats: Map<string, HotPathStat> | null;
  rendererMode: string;
  startedAt: number;
  textureStats: Map<object, TextureHotPathStat> | null;
}

interface StartGpuBackendFrameOptions {
  gpuAttributionEnabled?: boolean;
  pageVisible?: boolean;
  rendererMode?: string | null;
  startedAt?: number;
  warn?: (message: string) => void;
}

interface InstrumentGpuBackendHotPathsOptions {
  compileMeasurementWindowMs?: number;
  /** Rolling 1s window reports are a firehose; they default to ?logs=1 only. */
  emitWindowReports?: boolean;
  now?: () => number;
  reportIntervalMs?: number;
  warn?: (message: string) => void;
}

const HOT_PATH_NAMES = [
  "createRenderPipeline",
  "createComputePipeline",
  "createProgram",
  "createAttribute",
  "createStorageAttribute",
  "updateAttribute",
  "createTexture",
  "updateTexture",
  "createBindings",
  "updateBindings",
  "createSampler",
] as const;
const SLOW_CALL_THRESHOLD_MS = 80;
const SPIKE_FRAME_THRESHOLD_MS = 33;
// Production sink for spike frames: one digest line per window instead of one line per frame, so a hot laptop
// does not bury the console under hundreds of 40 ms spikes. Frames this long are always worth their own line.
const SPIKE_DIGEST_WINDOW_MS = 10_000;
const SPIKE_PASSTHROUGH_MS = 1_000;
const TOP_FRAME_HOT_PATH_LIMIT = 8;
const TOP_TEXTURE_LIMIT = 8;
const COMPILE_MEASUREMENT_WINDOW_MS = 60_000;
const instrumentedBackends = new WeakSet<object>();
const activeFrame: ActiveGpuBackendFrame = {
  gpuAttributionEnabled: false,
  hotPathStats: null,
  rendererMode: "uninitialized",
  startedAt: 0,
  textureStats: null,
};
let hasActiveFrame = false;
let isPageVisibilityListenerInstalled = false;
let compiledRenderPipelineCount = 0;
let gpuBackendAttributionEnabled = false;
const spikeDigest = { count: 0, maxDurationMs: 0, windowStartedAt: 0, worstReport: "" };

function digestSpikeFrame(durationMs: number, report: string, now: number): void {
  if (durationMs >= SPIKE_PASSTHROUGH_MS) console.warn(report);
  if (spikeDigest.count === 0) spikeDigest.windowStartedAt = now;
  spikeDigest.count += 1;
  if (durationMs > spikeDigest.maxDurationMs) {
    spikeDigest.maxDurationMs = durationMs;
    spikeDigest.worstReport = report;
  }
  if (now - spikeDigest.windowStartedAt < SPIKE_DIGEST_WINDOW_MS) return;
  const windowSeconds = ((now - spikeDigest.windowStartedAt) / 1000).toFixed(1);
  console.warn(
    `[FramePerf] ${spikeDigest.count} spike frames in ${windowSeconds}s, worst ${Math.round(spikeDigest.maxDurationMs)}ms — ${spikeDigest.worstReport}`,
  );
  spikeDigest.count = 0;
  spikeDigest.maxDurationMs = 0;
  spikeDigest.worstReport = "";
}

export function getCompiledRenderPipelineCount(): number {
  return compiledRenderPipelineCount;
}

export function startGpuBackendFrame(options?: StartGpuBackendFrameOptions): void {
  installPageVisibilityListener();
  const pageVisible = options?.pageVisible ?? getPageVisibility();
  if (!pageVisible) {
    discardGpuBackendFrame();
    return;
  }

  const startedAt = options?.startedAt ?? performance.now();
  reportCompletedGpuBackendFrame(startedAt, options?.warn);
  activeFrame.gpuAttributionEnabled = options?.gpuAttributionEnabled ?? gpuBackendAttributionEnabled;
  activeFrame.hotPathStats = null;
  activeFrame.rendererMode = options?.rendererMode ?? getRendererDiagnosticActiveMode() ?? "uninitialized";
  activeFrame.startedAt = startedAt;
  activeFrame.textureStats = null;
  hasActiveFrame = true;
}

export function discardGpuBackendFrame(): void {
  hasActiveFrame = false;
  activeFrame.hotPathStats = null;
  activeFrame.textureStats = null;
  consumeDominantFrameWorkOwner();
}

function installPageVisibilityListener(): void {
  if (isPageVisibilityListenerInstalled || typeof document === "undefined") {
    return;
  }

  document.addEventListener("visibilitychange", discardFrameWhenPageIsHidden);
  isPageVisibilityListenerInstalled = true;
}

function discardFrameWhenPageIsHidden(): void {
  if (!getPageVisibility()) {
    discardGpuBackendFrame();
  }
}

function getPageVisibility(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function reportCompletedGpuBackendFrame(endedAt: number = performance.now(), warn?: (message: string) => void): void {
  const owner = consumeDominantFrameWorkOwner();
  if (!hasActiveFrame) {
    return;
  }
  hasActiveFrame = false;

  const durationMs = endedAt - activeFrame.startedAt;
  if (durationMs <= SPIKE_FRAME_THRESHOLD_MS) {
    return;
  }

  const report = buildGpuBackendSpikeReport(
    durationMs,
    owner,
    activeFrame.rendererMode,
    activeFrame.gpuAttributionEnabled,
    activeFrame.hotPathStats,
    activeFrame.textureStats,
  );
  if (warn) warn(report);
  else digestSpikeFrame(durationMs, report, endedAt);
}

export function instrumentGpuBackendHotPaths(
  backend: Record<string, unknown>,
  options: InstrumentGpuBackendHotPathsOptions = {},
): void {
  if (instrumentedBackends.has(backend)) {
    return;
  }
  instrumentedBackends.add(backend);

  const now = options.now ?? (() => performance.now());
  const compileMeasurementWindowMs = options.compileMeasurementWindowMs ?? COMPILE_MEASUREMENT_WINDOW_MS;
  const emitWindowReports = options.emitWindowReports ?? VERBOSE_LOGS_ENABLED;
  const reportIntervalMs = options.reportIntervalMs ?? 1_000;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const hotPathStats = new Map<string, HotPathStat>();
  const textureStats = new Map<object, TextureHotPathStat>();
  let reportWindowStartedAt = now();
  const compileMeasurementStartedAt = reportWindowStartedAt;
  const compileStats = new Map<string, HotPathStat>();
  let compileMeasurementReported = false;

  const reportWindow = (windowEndedAt: number) => {
    if (hotPathStats.size === 0) {
      reportWindowStartedAt = windowEndedAt;
      return;
    }

    if (emitWindowReports) {
      warn(buildGpuBackendReport(windowEndedAt - reportWindowStartedAt, hotPathStats, textureStats));
    }
    hotPathStats.clear();
    textureStats.clear();
    reportWindowStartedAt = windowEndedAt;
  };

  let instrumentedHotPathCount = 0;
  for (const name of HOT_PATH_NAMES) {
    const original = backend[name];
    if (typeof original !== "function") {
      continue;
    }

    instrumentedHotPathCount += 1;
    backend[name] = function (this: unknown, ...args: unknown[]) {
      const startedAt = now();
      const result = (original as (...fnArgs: unknown[]) => unknown).apply(this, args);
      const endedAt = now();
      const elapsedMs = endedAt - startedAt;

      if (name === "createRenderPipeline") {
        compiledRenderPipelineCount += 1;
      }

      addHotPathSample(hotPathStats, name, elapsedMs);
      if (name === "createRenderPipeline" || name === "createProgram") {
        addHotPathSample(compileStats, name, elapsedMs);
      }
      addFrameHotPathSample(name, elapsedMs);
      if (name === "updateTexture") {
        addTextureSample(textureStats, args[0], elapsedMs);
        addFrameTextureSample(args[0], elapsedMs);
      }
      if (emitWindowReports && elapsedMs > SLOW_CALL_THRESHOLD_MS) {
        warn(`[GpuBackendPerf] ${name} took ${Math.round(elapsedMs)}ms in one call`);
      }
      if (endedAt - reportWindowStartedAt >= reportIntervalMs) {
        reportWindow(endedAt);
      }
      if (!compileMeasurementReported && endedAt - compileMeasurementStartedAt >= compileMeasurementWindowMs) {
        compileMeasurementReported = true;
        warn(buildCompileMeasurementReport(endedAt - compileMeasurementStartedAt, compileStats));
      }

      return result;
    };
  }

  gpuBackendAttributionEnabled ||= instrumentedHotPathCount > 0;
}

function addFrameHotPathSample(name: string, elapsedMs: number): void {
  if (!hasActiveFrame) {
    return;
  }

  activeFrame.hotPathStats ??= new Map();
  addHotPathSample(activeFrame.hotPathStats, name, elapsedMs);
}

function addFrameTextureSample(candidate: unknown, elapsedMs: number): void {
  if (!hasActiveFrame) {
    return;
  }

  activeFrame.textureStats ??= new Map();
  addTextureSample(activeFrame.textureStats, candidate, elapsedMs);
}

function addHotPathSample(stats: Map<string, HotPathStat>, name: string, elapsedMs: number): void {
  const entry = stats.get(name) ?? { accumulatedMs: 0, calls: 0 };
  entry.accumulatedMs += elapsedMs;
  entry.calls += 1;
  stats.set(name, entry);
}

function addTextureSample(stats: Map<object, TextureHotPathStat>, candidate: unknown, elapsedMs: number): void {
  if (!candidate || typeof candidate !== "object") {
    return;
  }

  const texture = candidate as InstrumentedTexture;
  const entry = stats.get(candidate) ?? {
    accumulatedMs: 0,
    calls: 0,
    dimensions: resolveTextureDimensions(texture),
    name: texture.name?.trim() || texture.uuid || "unnamed-texture",
  };
  entry.accumulatedMs += elapsedMs;
  entry.calls += 1;
  stats.set(candidate, entry);
}

function buildGpuBackendReport(
  windowMs: number,
  hotPathStats: ReadonlyMap<string, HotPathStat>,
  textureStats: ReadonlyMap<object, TextureHotPathStat>,
): string {
  const hotPaths = [...hotPathStats.entries()]
    .sort(([, left], [, right]) => right.accumulatedMs - left.accumulatedMs)
    .map(([name, stat]) => `${name}=${formatMilliseconds(stat.accumulatedMs)}/${stat.calls}x`)
    .join(", ");
  const topTextures = [...textureStats.values()]
    .sort((left, right) => right.accumulatedMs - left.accumulatedMs)
    .slice(0, TOP_TEXTURE_LIMIT)
    .map((stat) => `${stat.name}(${stat.dimensions})=${formatMilliseconds(stat.accumulatedMs)}/${stat.calls}x`)
    .join(", ");
  const textureSummary = textureStats.size > 0 ? `; textures[${textureStats.size}]=${topTextures}` : "";

  return `[GpuBackendPerf] window=${Math.round(windowMs)}ms ${hotPaths}${textureSummary}`;
}

// Below this share of the frame, GPU backend work does not explain the spike
// and its call listing is noise — the owner attribution is the report.
const MATERIAL_GPU_SHARE = 0.2;
const MATERIAL_GPU_MS = 8;

function buildGpuBackendSpikeReport(
  durationMs: number,
  owner: DominantFrameWorkOwner | null,
  rendererMode: string,
  gpuAttributionEnabled: boolean,
  hotPathStats: ReadonlyMap<string, HotPathStat> | null,
  textureStats: ReadonlyMap<object, TextureHotPathStat> | null,
): string {
  // owner_ms is the dominant owner's total across the frame's calls and owner_max_ms its longest single call: a
  // frame that stalled for one long task reads differently from one that ran many short slices.
  const ownerSummary = owner
    ? ` owner_ms=${Math.round(owner.durationMs)} owner_max_ms=${Math.round(owner.maxCallMs)}`
    : "";
  const frameSummary = `[FramePerf] spike renderer_mode=${rendererMode} duration_ms=${Math.round(
    durationMs,
  )} frame_owner=${owner?.owner ?? "unattributed"}${ownerSummary}`;
  if (!gpuAttributionEnabled) {
    return `${frameSummary} gpu_attribution=disabled`;
  }

  const gpuTotalMs = hotPathStats
    ? [...hotPathStats.values()].reduce((total, stat) => total + stat.accumulatedMs, 0)
    : 0;
  const gpuIsMaterial = gpuTotalMs >= MATERIAL_GPU_MS || gpuTotalMs >= durationMs * MATERIAL_GPU_SHARE;

  let gpuSummary: string;
  if (!hotPathStats || gpuTotalMs === 0) {
    gpuSummary = "gpu_attribution=enabled gpu_backend_ms=0 attribution=cpu-bound";
  } else if (!gpuIsMaterial) {
    gpuSummary = `gpu_attribution=enabled gpu_backend_ms=${formatMillisecondValue(gpuTotalMs)} attribution=cpu-bound`;
  } else {
    const contributors = [...hotPathStats.entries()]
      .sort(([, left], [, right]) => right.accumulatedMs - left.accumulatedMs)
      .slice(0, TOP_FRAME_HOT_PATH_LIMIT)
      .map(([name, stat]) => `${name}=${stat.calls}x/${formatMilliseconds(stat.accumulatedMs)}`)
      .join(", ");
    const topTextures = textureStats
      ? [...textureStats.values()]
          .sort((left, right) => right.accumulatedMs - left.accumulatedMs)
          .slice(0, TOP_TEXTURE_LIMIT)
          .map((stat) => `${stat.name}(${stat.dimensions})=${stat.calls}x/${formatMilliseconds(stat.accumulatedMs)}`)
          .join(", ")
      : "";
    const textureSummary = topTextures ? ` gpu_textures=${topTextures}` : "";
    gpuSummary = `gpu_attribution=enabled gpu_backend_ms=${formatMillisecondValue(
      gpuTotalMs,
    )} attribution=material gpu_contributors=${contributors}${textureSummary}`;
  }

  return `${frameSummary} ${gpuSummary}`;
}

function buildCompileMeasurementReport(windowMs: number, stats: ReadonlyMap<string, HotPathStat>): string {
  const summary = ["createRenderPipeline", "createProgram"]
    .map((name) => {
      const stat = stats.get(name) ?? { accumulatedMs: 0, calls: 0 };
      return `${name}=${stat.calls}x/${formatMilliseconds(stat.accumulatedMs)}`;
    })
    .join(", ");
  return `[GpuBackendPerf] compile-on-demand window=${Math.round(windowMs)}ms ${summary}`;
}

function resolveTextureDimensions(texture: InstrumentedTexture): string {
  const image = texture.source?.data ?? texture.image;
  if (!image) {
    return "unknown";
  }

  const width = image.width ?? image.videoWidth ?? image.naturalWidth;
  const height = image.height ?? image.videoHeight ?? image.naturalHeight;
  if (!width || !height) {
    return "unknown";
  }

  return image.depth && image.depth > 1 ? `${width}x${height}x${image.depth}` : `${width}x${height}`;
}

function formatMilliseconds(value: number): string {
  return `${formatMillisecondValue(value)}ms`;
}

function formatMillisecondValue(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0);
}
