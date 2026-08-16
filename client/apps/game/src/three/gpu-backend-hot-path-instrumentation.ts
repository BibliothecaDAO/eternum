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
  hotPathStats: Map<string, HotPathStat> | null;
  startedAt: number;
  textureStats: Map<object, TextureHotPathStat> | null;
}

interface InstrumentGpuBackendHotPathsOptions {
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
const TOP_FRAME_HOT_PATH_LIMIT = 8;
const TOP_TEXTURE_LIMIT = 8;
const instrumentedBackends = new WeakSet<object>();
let activeFrame: ActiveGpuBackendFrame | null = null;

export function startGpuBackendFrame(
  startedAt: number = performance.now(),
  warn: (message: string) => void = console.warn,
): void {
  reportCompletedGpuBackendFrame(startedAt, warn);
  activeFrame = {
    hotPathStats: null,
    startedAt,
    textureStats: null,
  };
}

function reportCompletedGpuBackendFrame(
  endedAt: number = performance.now(),
  warn: (message: string) => void = console.warn,
): void {
  const completedFrame = activeFrame;
  activeFrame = null;
  if (!completedFrame) {
    return;
  }

  const durationMs = endedAt - completedFrame.startedAt;
  if (durationMs <= SPIKE_FRAME_THRESHOLD_MS) {
    return;
  }

  warn(buildGpuBackendSpikeReport(durationMs, completedFrame.hotPathStats, completedFrame.textureStats));
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
  const reportIntervalMs = options.reportIntervalMs ?? 1_000;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const hotPathStats = new Map<string, HotPathStat>();
  const textureStats = new Map<object, TextureHotPathStat>();
  let reportWindowStartedAt = now();

  const reportWindow = (windowEndedAt: number) => {
    if (hotPathStats.size === 0) {
      reportWindowStartedAt = windowEndedAt;
      return;
    }

    warn(buildGpuBackendReport(windowEndedAt - reportWindowStartedAt, hotPathStats, textureStats));
    hotPathStats.clear();
    textureStats.clear();
    reportWindowStartedAt = windowEndedAt;
  };

  for (const name of HOT_PATH_NAMES) {
    const original = backend[name];
    if (typeof original !== "function") {
      continue;
    }

    backend[name] = function (this: unknown, ...args: unknown[]) {
      const startedAt = now();
      const result = (original as (...fnArgs: unknown[]) => unknown).apply(this, args);
      const endedAt = now();
      const elapsedMs = endedAt - startedAt;

      addHotPathSample(hotPathStats, name, elapsedMs);
      addFrameHotPathSample(name, elapsedMs);
      if (name === "updateTexture") {
        addTextureSample(textureStats, args[0], elapsedMs);
        addFrameTextureSample(args[0], elapsedMs);
      }
      if (elapsedMs > SLOW_CALL_THRESHOLD_MS) {
        warn(`[GpuBackendPerf] ${name} took ${Math.round(elapsedMs)}ms in one call`);
      }
      if (endedAt - reportWindowStartedAt >= reportIntervalMs) {
        reportWindow(endedAt);
      }

      return result;
    };
  }
}

function addFrameHotPathSample(name: string, elapsedMs: number): void {
  if (!activeFrame) {
    return;
  }

  activeFrame.hotPathStats ??= new Map();
  addHotPathSample(activeFrame.hotPathStats, name, elapsedMs);
}

function addFrameTextureSample(candidate: unknown, elapsedMs: number): void {
  if (!activeFrame) {
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

function buildGpuBackendSpikeReport(
  durationMs: number,
  hotPathStats: ReadonlyMap<string, HotPathStat> | null,
  textureStats: ReadonlyMap<object, TextureHotPathStat> | null,
): string {
  const contributors = hotPathStats
    ? [...hotPathStats.entries()]
        .sort(([, left], [, right]) => right.accumulatedMs - left.accumulatedMs)
        .slice(0, TOP_FRAME_HOT_PATH_LIMIT)
        .map(([name, stat]) => `${name}=${stat.calls}x/${formatMilliseconds(stat.accumulatedMs)}`)
        .join(", ")
    : "no GPU backend hot paths";
  const topTextures = textureStats
    ? [...textureStats.values()]
        .sort((left, right) => right.accumulatedMs - left.accumulatedMs)
        .slice(0, TOP_TEXTURE_LIMIT)
        .map((stat) => `${stat.name}(${stat.dimensions})=${stat.calls}x/${formatMilliseconds(stat.accumulatedMs)}`)
        .join(", ")
    : "";
  const textureSummary = topTextures ? `; textures=${topTextures}` : "";

  return `[GpuBackendPerf] spike ${Math.round(durationMs)}ms: ${contributors}${textureSummary}`;
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
  return `${value.toFixed(value < 10 ? 1 : 0)}ms`;
}
