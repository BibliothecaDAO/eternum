import type { WorldmapForceRefreshReason } from "../perf/worldmap-render-diagnostics";

interface ChunkSwitchPosition {
  x: number;
  z: number;
}

interface ChunkSwitchDelayInput {
  hasChunkSwitchAnchor: boolean;
  lastChunkSwitchPosition: ChunkSwitchPosition | undefined;
  cameraPosition: ChunkSwitchPosition;
  chunkSize: number;
  hexSize: number;
  chunkSwitchPadding: number;
}

interface WorldmapChunkRefreshDebounceInput {
  force: boolean;
  reason: WorldmapForceRefreshReason;
}

interface WorldmapChunkRefreshScheduleInput {
  existingDeadlineAtMs: number | null;
  nowMs: number;
  requestedDelayMs: number;
}

interface WorldmapChunkRefreshScheduleDecision {
  shouldScheduleTimer: boolean;
  delayMs: number;
  deadlineAtMs: number;
}

export const WORLDMAP_TRAVERSAL_REFRESH_DEBOUNCE_MS = 32;
export const WORLDMAP_FORCED_DEFAULT_REFRESH_DEBOUNCE_MS = 64;
export const WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS = 140;

export function shouldDelayWorldmapChunkSwitch(input: ChunkSwitchDelayInput): boolean {
  if (!input.hasChunkSwitchAnchor || !input.lastChunkSwitchPosition) {
    return false;
  }

  const chunkWorldWidth = input.chunkSize * input.hexSize * Math.sqrt(3);
  const chunkWorldDepth = input.chunkSize * input.hexSize * 1.5;
  const dx = Math.abs(input.cameraPosition.x - input.lastChunkSwitchPosition.x);
  const dz = Math.abs(input.cameraPosition.z - input.lastChunkSwitchPosition.z);

  return dx < chunkWorldWidth * input.chunkSwitchPadding && dz < chunkWorldDepth * input.chunkSwitchPadding;
}

export function resolveWorldmapChunkRefreshDebounceMs(input: WorldmapChunkRefreshDebounceInput): number {
  if (input.reason === "shortcut") {
    return 0;
  }

  if (!input.force && input.reason === "default") {
    return WORLDMAP_TRAVERSAL_REFRESH_DEBOUNCE_MS;
  }

  if (input.force && input.reason === "default") {
    return WORLDMAP_FORCED_DEFAULT_REFRESH_DEBOUNCE_MS;
  }

  return WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS;
}

export function resolveWorldmapChunkRefreshSchedule(
  input: WorldmapChunkRefreshScheduleInput,
): WorldmapChunkRefreshScheduleDecision {
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : 0;
  const requestedDelayMs = Number.isFinite(input.requestedDelayMs) ? Math.max(0, input.requestedDelayMs) : 0;
  const requestedDeadlineAtMs = nowMs + requestedDelayMs;

  if (input.existingDeadlineAtMs !== null && input.existingDeadlineAtMs <= requestedDeadlineAtMs) {
    return {
      shouldScheduleTimer: false,
      delayMs: Math.max(0, input.existingDeadlineAtMs - nowMs),
      deadlineAtMs: input.existingDeadlineAtMs,
    };
  }

  return {
    shouldScheduleTimer: true,
    delayMs: requestedDelayMs,
    deadlineAtMs: requestedDeadlineAtMs,
  };
}
