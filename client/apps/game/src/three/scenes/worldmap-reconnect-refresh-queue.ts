export interface ReconnectRefreshQueueState {
  hasPendingRefresh: boolean;
}

export function createReconnectRefreshQueueState(): ReconnectRefreshQueueState {
  return { hasPendingRefresh: false };
}

export interface QueueOrRunReconnectRefreshInput {
  state: ReconnectRefreshQueueState;
  currentChunk: string | null;
  runRefresh: () => void;
}

export function queueOrRunReconnectRefresh(input: QueueOrRunReconnectRefreshInput): void {
  if (!input.currentChunk || input.currentChunk === "null") {
    input.state.hasPendingRefresh = true;
    return;
  }
  input.runRefresh();
}

export interface DrainReconnectRefreshQueueInput {
  state: ReconnectRefreshQueueState;
  runRefresh: () => void;
}

export function drainReconnectRefreshQueue(input: DrainReconnectRefreshQueueInput): void {
  if (!input.state.hasPendingRefresh) {
    return;
  }
  input.state.hasPendingRefresh = false;
  input.runRefresh();
}
