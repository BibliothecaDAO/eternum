import { shouldRunManagerUpdate } from "../scenes/worldmap-chunk-transition";

export const MANAGER_UNCOMMITTED_CHUNK = "null";

export function isCommittedManagerChunk(chunkKey: string | null | undefined): chunkKey is string {
  if (!chunkKey || chunkKey === MANAGER_UNCOMMITTED_CHUNK) {
    return false;
  }

  const [startRow, startCol, extra] = chunkKey.split(",");
  if (extra !== undefined) {
    return false;
  }

  return Number.isFinite(Number(startRow)) && Number.isFinite(Number(startCol));
}

export function shouldAcceptManagerChunkRequest(input: {
  chunkKey: string;
  transitionToken?: number;
  latestTransitionToken: number;
  knownChunkForToken?: string;
}): boolean {
  if (!isCommittedManagerChunk(input.chunkKey)) {
    return false;
  }

  if (input.transitionToken === undefined) {
    return true;
  }

  if (input.transitionToken < input.latestTransitionToken) {
    return false;
  }

  if (input.knownChunkForToken !== undefined && input.knownChunkForToken !== input.chunkKey) {
    return false;
  }

  return true;
}

export function shouldRunManagerChunkUpdate(input: {
  chunkKey: string;
  currentChunk: string | null | undefined;
  transitionToken?: number;
  latestTransitionToken: number;
}): boolean {
  if (!isCommittedManagerChunk(input.chunkKey) || !isCommittedManagerChunk(input.currentChunk)) {
    return false;
  }

  return shouldRunManagerUpdate({
    transitionToken: input.transitionToken,
    expectedTransitionToken: input.latestTransitionToken,
    currentChunk: input.currentChunk,
    targetChunk: input.chunkKey,
  });
}

export function createCoalescedAsyncUpdateRunner(task: () => Promise<void>): () => Promise<void> {
  let updateInFlight: Promise<void> | null = null;
  let requestedVersion = 0;
  let processedVersion = 0;

  const run = async (): Promise<void> => {
    requestedVersion += 1;

    if (updateInFlight) {
      await updateInFlight;
      return;
    }

    updateInFlight = (async () => {
      while (processedVersion < requestedVersion) {
        processedVersion = requestedVersion;
        await task();
      }
    })();

    try {
      await updateInFlight;
    } finally {
      updateInFlight = null;
    }
  };

  return run;
}

export function waitForVisualSettle(
  requestAnimationFrameScheduler?: ((callback: FrameRequestCallback) => number) | null,
  timeoutScheduler?: (callback: () => void) => number,
): Promise<void> {
  const rafScheduler =
    requestAnimationFrameScheduler === undefined ? globalThis.requestAnimationFrame : requestAnimationFrameScheduler;
  if (typeof rafScheduler === "function") {
    return new Promise((resolve) => {
      rafScheduler(() => resolve());
    });
  }

  const fallbackScheduler = timeoutScheduler ?? ((callback: () => void) => globalThis.setTimeout(callback, 0));
  return new Promise((resolve) => {
    fallbackScheduler(() => resolve());
  });
}
