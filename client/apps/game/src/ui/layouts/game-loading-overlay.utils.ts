export const HEXCEPTION_GRID_READY_EVENT = "hexception:grid-ready";

export type GridCoordinates = {
  col: number;
  row: number;
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
