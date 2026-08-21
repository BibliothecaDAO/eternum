import type { RenderProfile } from "./render-profile";

interface RunRendererAnimationTickInput {
  getCurrentTime: () => number;
  getCycleProgress: () => number;
  isDestroyed: boolean;
  isLabelRuntimeReady: boolean;
  lastTime: number;
  logDestroyed?: (message: string) => void;
  onFrameError?: (error: unknown) => void;
  onFrameSuccess?: () => void;
  renderFrame: (input: { currentTime: number; cycleProgress: number; deltaTime: number }) => boolean;
  requestNextFrame: () => void;
  targetFPS: number | null;
  updateControls?: () => void;
  updateStatsPanel?: () => void;
}

interface RendererAnimationFrameState {
  currentTime: number;
  deltaTime: number;
  lastTime: number;
  shouldSkipFrame: boolean;
}

export interface RendererFrameFailureCircuit {
  recordFailure(error: unknown): {
    repeatCount: number;
    shouldReport: boolean;
  };
  recordSuccess(): void;
}

export const RENDERER_FRAME_FAILURE_REPORT_INTERVAL = 60;
const RENDERER_FRAME_FAILURE_MAX_REPORT_INTERVAL = 3_600;

export function runRendererAnimationTick(input: RunRendererAnimationTickInput): number {
  if (shouldStopRendererAnimation(input)) {
    input.logDestroyed?.("GameRenderer destroyed, stopping animation loop");
    return input.lastTime;
  }

  if (shouldWaitForRendererLabels(input)) {
    input.requestNextFrame();
    return input.lastTime;
  }

  let nextLastTime = input.lastTime;

  try {
    const frameState = resolveRendererAnimationFrameState(input);
    nextLastTime = frameState.lastTime;
    if (frameState.shouldSkipFrame) {
      return nextLastTime;
    }

    input.updateStatsPanel?.();
    input.updateControls?.();
    const rendered = input.renderFrame({
      currentTime: frameState.currentTime,
      cycleProgress: input.getCycleProgress(),
      deltaTime: frameState.deltaTime,
    });
    if (rendered) {
      input.onFrameSuccess?.();
    }
  } catch (error) {
    if (!input.onFrameError) {
      throw error;
    }
    try {
      input.onFrameError(error);
    } catch (reportingError) {
      console.error("[GameRenderer] Failed to report renderer frame error", reportingError);
    }
  } finally {
    input.requestNextFrame();
  }

  return nextLastTime;
}

export function createRendererFrameFailureCircuit(): RendererFrameFailureCircuit {
  const failures = new Map<
    string,
    {
      nextReportRepeat: number;
      repeatCount: number;
    }
  >();

  return {
    recordFailure: (error) => {
      const fingerprint = createRendererFrameFailureFingerprint(error);
      const existing = failures.get(fingerprint);
      if (!existing) {
        failures.set(fingerprint, {
          nextReportRepeat: RENDERER_FRAME_FAILURE_REPORT_INTERVAL,
          repeatCount: 0,
        });
        return { repeatCount: 0, shouldReport: true };
      }

      existing.repeatCount += 1;
      const shouldReport = existing.repeatCount === existing.nextReportRepeat;
      if (shouldReport) {
        existing.nextReportRepeat =
          existing.nextReportRepeat < RENDERER_FRAME_FAILURE_MAX_REPORT_INTERVAL
            ? Math.min(existing.nextReportRepeat * 2, RENDERER_FRAME_FAILURE_MAX_REPORT_INTERVAL)
            : existing.repeatCount + RENDERER_FRAME_FAILURE_MAX_REPORT_INTERVAL;
      }

      return {
        repeatCount: existing.repeatCount,
        shouldReport,
      };
    },
    recordSuccess: () => {
      failures.clear();
    },
  };
}

function createRendererFrameFailureFingerprint(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}:${error.message}`;
  }

  return `${typeof error}:${String(error)}`;
}

export function resolveRendererPacedFps(input: {
  currentTime: number;
  lastInteractionTime: number;
  profile: Pick<RenderProfile, "pacing">;
}): number | null {
  const { idleFps, idleAfterMs, maxFps } = input.profile.pacing;
  if (!idleFps || input.currentTime - input.lastInteractionTime < idleAfterMs) {
    return maxFps;
  }
  return Math.min(idleFps, maxFps);
}

function shouldStopRendererAnimation(input: Pick<RunRendererAnimationTickInput, "isDestroyed">): boolean {
  return input.isDestroyed;
}

function shouldWaitForRendererLabels(input: Pick<RunRendererAnimationTickInput, "isLabelRuntimeReady">): boolean {
  return !input.isLabelRuntimeReady;
}

function resolveRendererAnimationFrameState(
  input: Pick<RunRendererAnimationTickInput, "getCurrentTime" | "lastTime" | "targetFPS">,
): RendererAnimationFrameState {
  const currentTime = input.getCurrentTime();
  const baselineTime = input.lastTime === 0 ? currentTime : input.lastTime;

  if (shouldThrottleRendererAnimationFrame({ currentTime, lastTime: baselineTime, targetFPS: input.targetFPS })) {
    return {
      currentTime,
      deltaTime: 0,
      lastTime: baselineTime,
      shouldSkipFrame: true,
    };
  }

  const frameTime = input.targetFPS ? 1000 / input.targetFPS : 0;

  return {
    currentTime,
    deltaTime: (currentTime - baselineTime) / 1000,
    // Carry the sub-frame remainder: snapping lastTime to currentTime makes
    // the cap beat against the display refresh and quantises 60 down to
    // 30/40/41 fps on 60/120/165 Hz monitors.
    lastTime: frameTime > 0 ? currentTime - ((currentTime - baselineTime) % frameTime) : currentTime,
    shouldSkipFrame: false,
  };
}

function shouldThrottleRendererAnimationFrame(input: {
  currentTime: number;
  lastTime: number;
  targetFPS: number | null;
}): boolean {
  if (!input.targetFPS) {
    return false;
  }

  const frameTime = 1000 / input.targetFPS;
  return input.currentTime - input.lastTime < frameTime;
}
