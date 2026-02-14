export const HEXCEPTION_GRID_READY_EVENT = "hexception:grid-ready";

type GridCoordinates = {
  col: number;
  row: number;
};

type EntryOverlayPhase = "handoff" | "scene_warmup" | "slow" | "ready";

export const getSceneWarmupProgress = (elapsedMs: number): number => {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 82;
  const bounded = Math.min(1, elapsedMs / 10_000);
  const progress = 82 + Math.round(13 * Math.sqrt(bounded));
  return Math.min(95, Math.max(82, progress));
};

export const resolveEntryOverlayPhase = ({
  isReady,
  hasNavigated,
  isSlow,
}: {
  isReady: boolean;
  hasNavigated: boolean;
  isSlow: boolean;
}): EntryOverlayPhase => {
  if (isReady) return "ready";
  if (!hasNavigated) return "handoff";
  if (isSlow) return "slow";
  return "scene_warmup";
};

const isMatchingCoordinates = (detail: Partial<GridCoordinates> | undefined, expected: GridCoordinates): boolean => {
  return detail?.col === expected.col && detail?.row === expected.row;
};

export const waitForHexceptionGridReady = (expected: GridCoordinates, timeoutMs: number): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const complete = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(HEXCEPTION_GRID_READY_EVENT, onReady as EventListener);
      resolve();
    };

    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<Partial<GridCoordinates> | undefined>).detail;
      if (!isMatchingCoordinates(detail, expected)) {
        return;
      }

      complete();
    };

    const timeoutId = window.setTimeout(complete, timeoutMs);

    window.addEventListener(HEXCEPTION_GRID_READY_EVENT, onReady as EventListener);
  });
};
