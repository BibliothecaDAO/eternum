import {
  WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS,
  resolveWorldmapChunkRefreshSchedule,
} from "./worldmap-chunk-switch-delay-policy";
import {
  resolveRefreshCompletionActions,
  resolveRefreshExecutionPlan,
  resolveRefreshRunningActions,
} from "./worldmap-chunk-transition";

export interface WorldmapChunkRefreshRuntimeState {
  appliedToken: number;
  deadlineAtMs: number | null;
  requestToken: number;
  rerunRequested: boolean;
  running: boolean;
  timeoutId: number | null;
}

interface ScheduleWorldmapChunkRefreshTimerInput {
  clearTimeoutFn: (timeoutId: number) => void;
  nowMs: number;
  onTimer: () => void;
  requestedDelayMs: number;
  setTimeoutFn: (callback: () => void, delayMs: number) => number;
  state: WorldmapChunkRefreshRuntimeState;
}

interface WaitForWorldmapRequestedChunkRefreshInput {
  fallbackDelayMs?: number;
  isSwitchedOff: () => boolean;
  latestWinsRefresh: boolean;
  requestToken: number;
  setTimeoutFn: (callback: () => void, delayMs: number) => number;
  state: WorldmapChunkRefreshRuntimeState;
}

interface RunWorldmapChunkRefreshExecutionInput {
  executeRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
  onExecutionComplete: (input: { executionToken: number; hasNewerRequest: boolean; latestToken: number }) => void;
  onRescheduleWhileRunning: (input: { latestToken: number; scheduledToken: number }) => void;
  onSuperseded: (input: { executionToken: number; latestToken: number; scheduledToken: number }) => void;
  scheduledToken: number;
  scheduleRerun: () => void;
  state: WorldmapChunkRefreshRuntimeState;
}

export function createWorldmapChunkRefreshRuntimeState(): WorldmapChunkRefreshRuntimeState {
  return {
    appliedToken: 0,
    deadlineAtMs: null,
    requestToken: 0,
    rerunRequested: false,
    running: false,
    timeoutId: null,
  };
}

export function requestWorldmapChunkRefreshToken(state: WorldmapChunkRefreshRuntimeState): number {
  state.requestToken += 1;
  return state.requestToken;
}

export function scheduleWorldmapChunkRefreshTimer(
  input: ScheduleWorldmapChunkRefreshTimerInput,
): WorldmapChunkRefreshRuntimeState {
  const scheduleDecision = resolveWorldmapChunkRefreshSchedule({
    existingDeadlineAtMs: input.state.deadlineAtMs,
    nowMs: input.nowMs,
    requestedDelayMs: input.requestedDelayMs,
  });
  if (!scheduleDecision.shouldScheduleTimer) {
    return input.state;
  }

  if (input.state.timeoutId !== null) {
    input.clearTimeoutFn(input.state.timeoutId);
  }

  input.state.deadlineAtMs = scheduleDecision.deadlineAtMs;
  input.state.timeoutId = input.setTimeoutFn(() => {
    input.state.timeoutId = null;
    input.state.deadlineAtMs = null;
    input.onTimer();
  }, scheduleDecision.delayMs);

  return input.state;
}

export function waitForWorldmapRequestedChunkRefresh(input: WaitForWorldmapRequestedChunkRefreshInput): Promise<void> {
  if (input.isSwitchedOff()) {
    return Promise.resolve();
  }

  if (!input.latestWinsRefresh) {
    return new Promise((resolve) =>
      input.setTimeoutFn(resolve, input.fallbackDelayMs ?? WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS),
    );
  }

  return new Promise((resolve) => {
    const poll = () => {
      if (input.isSwitchedOff()) {
        resolve();
        return;
      }

      if (input.state.appliedToken >= input.requestToken && !input.state.running && input.state.timeoutId === null) {
        resolve();
        return;
      }

      input.setTimeoutFn(poll, 0);
    };

    poll();
  });
}

export async function runWorldmapChunkRefreshExecution(input: RunWorldmapChunkRefreshExecutionInput): Promise<void> {
  const latestToken = input.state.requestToken;
  const refreshExecutionPlan = resolveRefreshExecutionPlan(input.scheduledToken, latestToken);
  const { executionToken, shouldRecordSuperseded } = refreshExecutionPlan;

  if (shouldRecordSuperseded) {
    input.onSuperseded({
      executionToken,
      latestToken,
      scheduledToken: input.scheduledToken,
    });
  }

  if (input.state.running) {
    const runningActions = resolveRefreshRunningActions(input.scheduledToken, input.state.requestToken);
    input.state.rerunRequested = runningActions.shouldMarkRerunRequested;
    if (runningActions.shouldRescheduleTimer) {
      input.onRescheduleWhileRunning({
        latestToken: input.state.requestToken,
        scheduledToken: input.scheduledToken,
      });
      input.scheduleRerun();
    }
    return;
  }

  input.state.running = true;

  try {
    await input.executeRefresh();
  } catch (error) {
    input.onError(error);
  } finally {
    input.state.running = false;
    input.state.appliedToken = executionToken;

    const completionActions = resolveRefreshCompletionActions({
      appliedToken: input.state.appliedToken,
      latestToken: input.state.requestToken,
      rerunRequested: input.state.rerunRequested,
    });
    input.onExecutionComplete({
      executionToken: input.state.appliedToken,
      hasNewerRequest: completionActions.hasNewerRequest,
      latestToken: input.state.requestToken,
    });
    if (completionActions.shouldClearRerunRequested) {
      input.state.rerunRequested = false;
    }
    if (completionActions.shouldScheduleRerun) {
      input.scheduleRerun();
    }
  }
}
