interface RunRendererAnimationTickInput {
  getCurrentTime: () => number;
  getCycleProgress: () => number;
  isDestroyed: boolean;
  isLabelRuntimeReady: boolean;
  lastTime: number;
  logDestroyed?: (message: string) => void;
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

export function runRendererAnimationTick(input: RunRendererAnimationTickInput): number {
  if (shouldStopRendererAnimation(input)) {
    input.logDestroyed?.("GameRenderer destroyed, stopping animation loop");
    return input.lastTime;
  }

  if (shouldWaitForRendererLabels(input)) {
    input.requestNextFrame();
    return input.lastTime;
  }

  const frameState = resolveRendererAnimationFrameState(input);
  if (frameState.shouldSkipFrame) {
    input.requestNextFrame();
    return frameState.lastTime;
  }

  input.updateStatsPanel?.();
  input.updateControls?.();
  input.renderFrame({
    currentTime: frameState.currentTime,
    cycleProgress: input.getCycleProgress(),
    deltaTime: frameState.deltaTime,
  });
  input.requestNextFrame();

  return frameState.lastTime;
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

  return {
    currentTime,
    deltaTime: (currentTime - baselineTime) / 1000,
    lastTime: currentTime,
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
