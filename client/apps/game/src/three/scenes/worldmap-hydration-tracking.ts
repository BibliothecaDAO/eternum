export interface WorldmapHydrationFetchState {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  fetchSettled: boolean;
}

export interface WorldmapHydrationUpdatePosition {
  col: number;
  row: number;
}

interface WorldmapHydrationTrackedFetchState extends WorldmapHydrationFetchState {
  pendingCount: number;
}

interface WorldmapHydrationClearableFetchState {
  waiters: Array<() => void>;
}

export function shouldTrackHydrationUpdateForFetch(
  state: WorldmapHydrationFetchState,
  position: WorldmapHydrationUpdatePosition,
): boolean {
  // Only the initial fetch-driven hydration work should block chunk presentation.
  // Once the fetch has settled, ongoing live stream traffic must not hold the
  // global chunk switch open or traversal can stall in busy areas.
  if (state.fetchSettled) {
    return false;
  }

  return (
    position.col >= state.minCol &&
    position.col <= state.maxCol &&
    position.row >= state.minRow &&
    position.row <= state.maxRow
  );
}

export function trackHydrationUpdateWorkForFetches<TState extends WorldmapHydrationTrackedFetchState>(input: {
  fetches: Map<string, TState>;
  flushWaiters: (fetchKey: string, state: TState) => void;
  position: WorldmapHydrationUpdatePosition;
  work: Promise<void>;
}): Promise<void> {
  const matchedFetchKeys: string[] = [];

  input.fetches.forEach((state, fetchKey) => {
    if (shouldTrackHydrationUpdateForFetch(state, input.position)) {
      state.pendingCount += 1;
      matchedFetchKeys.push(fetchKey);
    }
  });

  if (matchedFetchKeys.length === 0) {
    return input.work;
  }

  return input.work.finally(() => {
    matchedFetchKeys.forEach((fetchKey) => {
      const state = input.fetches.get(fetchKey);
      if (!state) {
        return;
      }
      state.pendingCount = Math.max(0, state.pendingCount - 1);
      input.flushWaiters(fetchKey, state);
    });
  });
}

export function clearHydrationFetchState<TState extends WorldmapHydrationClearableFetchState>(
  fetches: Map<string, TState>,
  fetchKey: string,
): void {
  const state = fetches.get(fetchKey);
  if (!state) {
    return;
  }

  const waiters = [...state.waiters];
  state.waiters.length = 0;
  fetches.delete(fetchKey);
  waiters.forEach((resolve) => resolve());
}
