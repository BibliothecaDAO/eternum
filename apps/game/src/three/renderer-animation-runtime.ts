interface RunRendererAnimationTickInput {
  getCurrentTime: () => number;
  getCycleProgress: () => number;
  isDestroyed: boolean;
  isLabelRuntimeReady: boolean;
  lastTime: number;
  lastFrameTime: number;
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
  lastFrameTime: number;
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

export function runRendererAnimationTick(input: RunRendererAnimationTickInput): {
  lastTime: number;
  lastFrameTime: number;
} {
  const timing = { lastTime: input.lastTime, lastFrameTime: input.lastFrameTime };
  if (shouldStopRendererAnimation(input)) {
    input.logDestroyed?.("GameRenderer destroyed, stopping animation loop");
    return timing;
  }

  if (shouldWaitForRendererLabels(input)) {
    input.requestNextFrame();
    return timing;
  }

  try {
    const frameState = resolveRendererAnimationFrameState(input);
    timing.lastTime = frameState.lastTime;
    timing.lastFrameTime = frameState.lastFrameTime;
    if (frameState.shouldSkipFrame) {
      return timing;
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

  return timing;
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

function shouldStopRendererAnimation(input: Pick<RunRendererAnimationTickInput, "isDestroyed">): boolean {
  return input.isDestroyed;
}

function shouldWaitForRendererLabels(input: Pick<RunRendererAnimationTickInput, "isLabelRuntimeReady">): boolean {
  return !input.isLabelRuntimeReady;
}

function resolveRendererAnimationFrameState(
  input: Pick<RunRendererAnimationTickInput, "getCurrentTime" | "lastTime" | "lastFrameTime" | "targetFPS">,
): RendererAnimationFrameState {
  const currentTime = input.getCurrentTime();
  const baselineTime = input.lastTime === 0 ? currentTime : input.lastTime;
  const previousFrameTime = input.lastFrameTime === 0 ? currentTime : input.lastFrameTime;

  const frameTime = input.targetFPS ? 1000 / input.targetFPS : 0;
  // Absorb floating-point rounding at exact refresh boundaries (for example 60 FPS on 60 Hz).
  const completedIntervals = frameTime > 0 ? Math.floor((currentTime - baselineTime + 0.000001) / frameTime) : 0;
  if (frameTime > 0 && completedIntervals === 0) {
    return {
      currentTime,
      deltaTime: 0,
      lastTime: baselineTime,
      lastFrameTime: previousFrameTime,
      shouldSkipFrame: true,
    };
  }

  return {
    currentTime,
    // Animation time follows actual frame intervals, never the pacing remainder.
    deltaTime: (currentTime - previousFrameTime) / 1000,
    lastFrameTime: currentTime,
    // Carry the sub-frame remainder: snapping lastTime to currentTime makes
    // the cap beat against the display refresh and quantises 60 down to
    // 30/40/41 fps on 60/120/165 Hz monitors.
    lastTime: frameTime > 0 ? baselineTime + completedIntervals * frameTime : currentTime,
    shouldSkipFrame: false,
  };
}
