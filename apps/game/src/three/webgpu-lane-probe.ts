import type { RendererBuildMode } from "./renderer-build-mode";

export type RendererLane = "webgpu" | "webgl2";
export type WebGpuProbeVerdict = "adapter" | "no-adapter" | "adapter-error" | "adapter-timeout" | "no-navigator-gpu";

export interface RendererLaneMemory {
  readonly lane: RendererLane;
  readonly reason: string;
  readonly recordedAt: number;
}

export interface WebGpuLaneStart {
  /** A fresh profile renders on WebGL2 now and proves WebGPU off the boot path for the next boot. */
  readonly forceWebGL: boolean;
  /** Set when the lane came from memory or a failed probe; null when WebGPU is being attempted. */
  readonly fallbackReason:
    | "webgpu-remembered-fallback"
    | "webgpu-unavailable"
    | "webgpu-probe-timeout"
    | "webgpu-unproven"
    | null;
  readonly remembered: boolean;
}

interface GpuAdapterProvider {
  requestAdapter(): Promise<unknown | null>;
}

interface ProbeWebGpuAdapterInput {
  gpu: GpuAdapterProvider | undefined;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  timeoutMs?: number;
}

interface ResolveWebGpuLaneStartInput {
  forceReprobe: boolean;
  probe: () => Promise<WebGpuProbeVerdict>;
  requestedMode: RendererBuildMode;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

export const RENDERER_LANE_STORAGE_KEY = "eternum-renderer-lane";
/** The half-two class 2 bar: the lane question is answered within a second, then remembered per profile. */
const WEBGPU_ADAPTER_PROBE_TIMEOUT_MS = 1_000;

/**
 * Asks the browser for a WebGPU adapter, bounded. Three's capability addon does
 * the same request as a top-level await, which is unbounded and turns every
 * chunk that imports it into an async module — this replaces it.
 */
export async function probeWebGpuAdapter(input: ProbeWebGpuAdapterInput): Promise<WebGpuProbeVerdict> {
  if (!input.gpu) return "no-navigator-gpu";
  const timeoutMs = input.timeoutMs ?? WEBGPU_ADAPTER_PROBE_TIMEOUT_MS;
  const setTimeoutFn = input.setTimeoutFn ?? setTimeout;
  const timeout = new Promise<WebGpuProbeVerdict>((resolve) => {
    setTimeoutFn(() => resolve("adapter-timeout"), timeoutMs);
  });
  const request = input.gpu
    .requestAdapter()
    .then((adapter): WebGpuProbeVerdict => (adapter ? "adapter" : "no-adapter"))
    .catch((): WebGpuProbeVerdict => "adapter-error");
  return Promise.race([request, timeout]);
}

export function readRememberedRendererLane(storage: Pick<Storage, "getItem"> | null): RendererLaneMemory | null {
  const raw = storage?.getItem(RENDERER_LANE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RendererLaneMemory>;
    if (parsed.lane !== "webgpu" && parsed.lane !== "webgl2") return null;
    return { lane: parsed.lane, reason: String(parsed.reason ?? ""), recordedAt: Number(parsed.recordedAt ?? 0) };
  } catch {
    return null;
  }
}

export function rememberRendererLane(
  storage: Pick<Storage, "setItem"> | null,
  lane: RendererLane,
  reason: string,
  now: () => number = Date.now,
): void {
  const memory: RendererLaneMemory = { lane, reason, recordedAt: now() };
  storage?.setItem(RENDERER_LANE_STORAGE_KEY, JSON.stringify(memory));
}

/**
 * Decides the lane to start on: a forced WebGL mode never probes; an explicit
 * `?rendererMode=` re-probes and rewrites the memory; otherwise the remembered
 * lane is reused and a fresh profile probes once.
 */
export async function resolveWebGpuLaneStart(input: ResolveWebGpuLaneStartInput): Promise<WebGpuLaneStart> {
  if (input.requestedMode === "webgpu-force-webgl") {
    return { fallbackReason: null, forceWebGL: true, remembered: false };
  }

  const stored = input.forceReprobe ? null : readRememberedRendererLane(input.storage);
  // WebGPU is parked: an idle-era promotion is not proof boot-time init works, so it is discarded.
  const remembered = stored && stored.lane === "webgpu" && stored.reason.startsWith("idle:") ? null : stored;
  if (remembered) {
    return {
      fallbackReason: remembered.lane === "webgl2" ? "webgpu-remembered-fallback" : null,
      forceWebGL: remembered.lane === "webgl2",
      remembered: true,
    };
  }

  if (!input.forceReprobe) {
    return {
      fallbackReason: "webgpu-unproven",
      forceWebGL: true,
      remembered: false,
    };
  }

  const verdict = await input.probe();
  const lane: RendererLane = verdict === "adapter" ? "webgpu" : "webgl2";
  if (lane === "webgl2") rememberRendererLane(input.storage, lane, verdict);
  return {
    fallbackReason: resolveProbeFallbackReason(verdict),
    forceWebGL: lane === "webgl2",
    remembered: false,
  };
}

function resolveProbeFallbackReason(verdict: WebGpuProbeVerdict): WebGpuLaneStart["fallbackReason"] {
  if (verdict === "adapter") return null;
  return verdict === "adapter-timeout" ? "webgpu-probe-timeout" : "webgpu-unavailable";
}
