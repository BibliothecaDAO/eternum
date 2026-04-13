export const HEXCEPTION_GRID_READY_EVENT = "hexception:grid-ready";
export const WORLDMAP_SCENE_READY_EVENT = "worldmap:scene-ready";
export const FAST_TRAVEL_SCENE_READY_EVENT = "fast-travel:scene-ready";
const HEXCEPTION_READY_STATE_TTL_MS = 5_000;

type GridCoordinates = {
  col: number;
  row: number;
};

type EntryOverlayPhase = "handoff" | "scene_warmup" | "slow" | "timed_out" | "ready";

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
  didSafetyTimeout,
}: {
  isReady: boolean;
  hasNavigated: boolean;
  isSlow: boolean;
  didSafetyTimeout: boolean;
}): EntryOverlayPhase => {
  if (isReady) return "ready";
  if (didSafetyTimeout) return "timed_out";
  if (!hasNavigated) return "handoff";
  if (isSlow) return "slow";
  return "scene_warmup";
};

const isMatchingCoordinates = (detail: Partial<GridCoordinates> | undefined, expected: GridCoordinates): boolean => {
  return detail?.col === expected.col && detail?.row === expected.row;
};

type HexceptionReadyState = GridCoordinates & {
  announcedAt: number;
};

type OverlayReadyWindow = Window & {
  __eternumHexceptionReadyState?: HexceptionReadyState;
};

const getOverlayReadyWindow = (): OverlayReadyWindow | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window as OverlayReadyWindow;
};

const isFreshHexceptionReadyState = (readyState: HexceptionReadyState): boolean => {
  return Date.now() - readyState.announcedAt <= HEXCEPTION_READY_STATE_TTL_MS;
};

const getRememberedHexceptionReadyState = (): HexceptionReadyState | null => {
  const readyWindow = getOverlayReadyWindow();
  if (!readyWindow?.__eternumHexceptionReadyState) {
    return null;
  }

  const readyState = readyWindow.__eternumHexceptionReadyState;
  if (!isFreshHexceptionReadyState(readyState)) {
    delete readyWindow.__eternumHexceptionReadyState;
    return null;
  }

  return readyState;
};

export const rememberHexceptionGridReady = (coords: GridCoordinates): void => {
  const readyWindow = getOverlayReadyWindow();
  if (!readyWindow) {
    return;
  }

  readyWindow.__eternumHexceptionReadyState = {
    ...coords,
    announcedAt: Date.now(),
  };
};

export const clearRememberedHexceptionGridReady = (): void => {
  const readyWindow = getOverlayReadyWindow();
  if (!readyWindow) {
    return;
  }

  delete readyWindow.__eternumHexceptionReadyState;
};

export const waitForHexceptionGridReady = (expected: GridCoordinates, timeoutMs: number): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(true);
  }

  const readyState = getRememberedHexceptionReadyState();
  if (readyState && isMatchingCoordinates(readyState, expected)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const complete = (didReceiveReadySignal: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(HEXCEPTION_GRID_READY_EVENT, onReady as EventListener);
      resolve(didReceiveReadySignal);
    };

    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<Partial<GridCoordinates> | undefined>).detail;
      if (!isMatchingCoordinates(detail, expected)) {
        return;
      }

      complete(true);
    };

    const timeoutId = window.setTimeout(() => complete(false), timeoutMs);

    window.addEventListener(HEXCEPTION_GRID_READY_EVENT, onReady as EventListener);
  });
};

export const waitForWorldmapSceneReady = (timeoutMs: number): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const complete = (didReceiveSceneReadySignal: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(WORLDMAP_SCENE_READY_EVENT, onReady as EventListener);
      resolve(didReceiveSceneReadySignal);
    };

    const onReady = () => {
      complete(true);
    };

    const timeoutId = window.setTimeout(() => complete(false), timeoutMs);

    window.addEventListener(WORLDMAP_SCENE_READY_EVENT, onReady as EventListener);
  });
};

export const waitForFastTravelSceneReady = (timeoutMs: number): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const complete = (didReceiveSceneReadySignal: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(FAST_TRAVEL_SCENE_READY_EVENT, onReady as EventListener);
      resolve(didReceiveSceneReadySignal);
    };

    const onReady = () => {
      complete(true);
    };

    const timeoutId = window.setTimeout(() => complete(false), timeoutMs);

    window.addEventListener(FAST_TRAVEL_SCENE_READY_EVENT, onReady as EventListener);
  });
};
