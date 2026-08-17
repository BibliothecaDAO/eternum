import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";

const RENDERER_STARTUP_TIMING_NAMES = [
  "webgpu-module-import",
  "webgpu-renderer-create",
  "webgpu-renderer-init",
  "webgpu-backend-total",
] as const;

export type RendererStartupTimingName = (typeof RENDERER_STARTUP_TIMING_NAMES)[number];
export type RendererStartupTimingsSnapshot = Record<string, number>;

let rendererStartupTimings: RendererStartupTimingsSnapshot = {};

export function recordRendererStartupTiming(name: RendererStartupTimingName, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  const roundedDurationMs = Math.round(durationMs);
  rendererStartupTimings = {
    ...rendererStartupTimings,
    [name]: roundedDurationMs,
  };
  recordGameEntryDuration(`renderer-init-${name}`, roundedDurationMs);
}

export function snapshotRendererStartupTimings(): RendererStartupTimingsSnapshot {
  return { ...rendererStartupTimings };
}

export function resetRendererStartupTimings(): void {
  rendererStartupTimings = {};
}
