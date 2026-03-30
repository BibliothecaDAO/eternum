interface WorldmapHydrationFetchState {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  fetchSettled: boolean;
}

interface WorldmapHydrationUpdatePosition {
  col: number;
  row: number;
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
