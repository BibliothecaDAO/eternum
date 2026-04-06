import type { WorldmapForceRefreshReason } from "../perf/worldmap-render-diagnostics";

export const WORLDMAP_EXACT_TILE_FETCH_TIMEOUT_MS = 8_000;
export const WORLDMAP_HYDRATION_IDLE_TIMEOUT_MS = 4_000;
export const WORLDMAP_BACKGROUND_REFRESH_WATCHDOG_TIMEOUT_MS = 10_000;
export const WORLDMAP_BLOCKING_SWITCH_WATCHDOG_TIMEOUT_MS = 12_000;

export class WorldmapChunkWorkTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`Timed out waiting for ${label} after ${timeoutMs}ms`);
    this.name = "WorldmapChunkWorkTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

interface ApplyBackgroundRefreshTimeoutStateInput {
  timedOutRefreshToken: number;
  currentChunkRefreshToken: number;
  currentChunkRefreshPromise: Promise<void> | null;
  currentChunkRefreshStartedAtMs: number | null;
  currentChunkRefreshReason: WorldmapForceRefreshReason | null;
  currentChunkRefreshTargetChunk: string | null;
}

interface ApplyBackgroundRefreshTimeoutStateResult {
  currentChunkRefreshToken: number;
  currentChunkRefreshPromise: Promise<void> | null;
  currentChunkRefreshStartedAtMs: number | null;
  currentChunkRefreshReason: WorldmapForceRefreshReason | null;
  currentChunkRefreshTargetChunk: string | null;
  didTimeoutLatestRefresh: boolean;
}

interface ApplyBlockingSwitchTimeoutStateInput {
  timedOutTransitionToken: number;
  chunkTransitionToken: number;
  pendingChunkFetchGeneration: number;
  globalChunkSwitchPromise: Promise<void> | null;
  isChunkTransitioning: boolean;
  shouldRetryBlockingSwitchOnNextControlsChange: boolean;
}

interface ApplyBlockingSwitchTimeoutStateResult {
  chunkTransitionToken: number;
  pendingChunkFetchGeneration: number;
  globalChunkSwitchPromise: Promise<void> | null;
  isChunkTransitioning: boolean;
  shouldRetryBlockingSwitchOnNextControlsChange: boolean;
  didTimeoutLatestBlockingSwitch: boolean;
}

export type WorldmapBackgroundRefreshOutcome = "completed" | "stale_dropped" | "timed_out";

export function applyBackgroundRefreshTimeoutState(
  input: ApplyBackgroundRefreshTimeoutStateInput,
): ApplyBackgroundRefreshTimeoutStateResult {
  if (input.timedOutRefreshToken !== input.currentChunkRefreshToken) {
    return {
      currentChunkRefreshToken: input.currentChunkRefreshToken,
      currentChunkRefreshPromise: input.currentChunkRefreshPromise,
      currentChunkRefreshStartedAtMs: input.currentChunkRefreshStartedAtMs,
      currentChunkRefreshReason: input.currentChunkRefreshReason,
      currentChunkRefreshTargetChunk: input.currentChunkRefreshTargetChunk,
      didTimeoutLatestRefresh: false,
    };
  }

  return {
    currentChunkRefreshToken: input.currentChunkRefreshToken + 1,
    currentChunkRefreshPromise: null,
    currentChunkRefreshStartedAtMs: null,
    currentChunkRefreshReason: null,
    currentChunkRefreshTargetChunk: null,
    didTimeoutLatestRefresh: true,
  };
}

export function applyBlockingSwitchTimeoutState(
  input: ApplyBlockingSwitchTimeoutStateInput,
): ApplyBlockingSwitchTimeoutStateResult {
  if (input.timedOutTransitionToken !== input.chunkTransitionToken) {
    return {
      chunkTransitionToken: input.chunkTransitionToken,
      pendingChunkFetchGeneration: input.pendingChunkFetchGeneration,
      globalChunkSwitchPromise: input.globalChunkSwitchPromise,
      isChunkTransitioning: input.isChunkTransitioning,
      shouldRetryBlockingSwitchOnNextControlsChange: input.shouldRetryBlockingSwitchOnNextControlsChange,
      didTimeoutLatestBlockingSwitch: false,
    };
  }

  return {
    chunkTransitionToken: input.chunkTransitionToken + 1,
    pendingChunkFetchGeneration: input.pendingChunkFetchGeneration + 1,
    globalChunkSwitchPromise: null,
    isChunkTransitioning: false,
    shouldRetryBlockingSwitchOnNextControlsChange: true,
    didTimeoutLatestBlockingSwitch: true,
  };
}

export function shouldDropBackgroundRefreshWork(input: {
  refreshToken: number;
  currentRefreshToken: number;
  currentChunk: string;
  targetChunk: string;
  isSwitchedOff: boolean;
}): boolean {
  if (input.isSwitchedOff) {
    return true;
  }

  if (input.refreshToken !== input.currentRefreshToken) {
    return true;
  }

  return input.currentChunk !== input.targetChunk;
}

export function shouldRecordCompletedBackgroundRefresh(outcome: WorldmapBackgroundRefreshOutcome): boolean {
  return outcome === "completed";
}

export async function raceWorldmapChunkWorkAgainstTimeout<T>(input: {
  label: string;
  timeoutMs: number;
  work: Promise<T>;
  onTimeout?: () => void;
}): Promise<T> {
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
    return input.work;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      input.onTimeout?.();
      reject(new WorldmapChunkWorkTimeoutError(input.label, input.timeoutMs));
    }, input.timeoutMs);

    input.work.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
