export interface WorldmapReadyDetail {
  col: number;
  row: number;
  currentChunk: string;
}

export const WORLDMAP_READY_EVENT = "worldmap:ready";

function getTargetWindow(target?: Window): Window | undefined {
  if (target) {
    return target;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window;
}

function isMatchingCoordinates(
  detail: Partial<Pick<WorldmapReadyDetail, "col" | "row">> | undefined,
  expected: Pick<WorldmapReadyDetail, "col" | "row">,
): boolean {
  return detail?.col === expected.col && detail?.row === expected.row;
}

export function getStoredWorldmapReadyDetail(target?: Window): WorldmapReadyDetail | null {
  const resolvedWindow = getTargetWindow(target) as (Window & { __worldmapReadyDetail?: WorldmapReadyDetail }) | undefined;
  return resolvedWindow?.__worldmapReadyDetail ?? null;
}

export function emitWorldmapReadyEvent(detail: WorldmapReadyDetail, target?: Window): void {
  const resolvedWindow = getTargetWindow(target) as (Window & { __worldmapReadyDetail?: WorldmapReadyDetail }) | undefined;
  if (!resolvedWindow) {
    return;
  }

  resolvedWindow.__worldmapReadyDetail = { ...detail };
  resolvedWindow.dispatchEvent(
    new CustomEvent<WorldmapReadyDetail>(WORLDMAP_READY_EVENT, {
      detail: { ...detail },
    }),
  );
}

export function waitForWorldmapReady(
  expected: Pick<WorldmapReadyDetail, "col" | "row">,
  timeoutMs: number,
  target?: Window,
): Promise<void> {
  const resolvedWindow = getTargetWindow(target);
  if (!resolvedWindow) {
    return Promise.resolve();
  }

  const cachedDetail = getStoredWorldmapReadyDetail(resolvedWindow);
  if (isMatchingCoordinates(cachedDetail ?? undefined, expected)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const complete = () => {
      if (settled) return;
      settled = true;
      resolvedWindow.clearTimeout(timeoutId);
      resolvedWindow.removeEventListener(WORLDMAP_READY_EVENT, onReady as EventListener);
      resolve();
    };

    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<WorldmapReadyDetail | undefined>).detail;
      if (!isMatchingCoordinates(detail, expected)) {
        return;
      }

      complete();
    };

    const timeoutId = resolvedWindow.setTimeout(complete, timeoutMs);
    resolvedWindow.addEventListener(WORLDMAP_READY_EVENT, onReady as EventListener);
  });
}
