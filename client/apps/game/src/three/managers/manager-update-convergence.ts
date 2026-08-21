import { shouldRunManagerUpdate } from "../scenes/worldmap-chunk-transition";

export const MANAGER_UNCOMMITTED_CHUNK = "null";

export type AsyncPassSnapshot = {
  version: number;
};

export function createAsyncPassFence(): {
  capture: () => AsyncPassSnapshot;
  invalidate: () => void;
  isCurrent: (snapshot: AsyncPassSnapshot) => boolean;
} {
  let version = 0;

  return {
    capture: () => ({ version }),
    invalidate: () => {
      version += 1;
    },
    isCurrent: (snapshot) => snapshot.version === version,
  };
}

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

interface CoalescedUpdateWaiter {
  reject: (reason: unknown) => void;
  resolve: () => void;
  version: number;
}

export function createCoalescedAsyncUpdateRunner(task: () => Promise<boolean>): () => Promise<void> {
  let isUpdateInFlight = false;
  let shouldRestartAfterCurrentPass = false;
  let requestedVersion = 0;
  let processedVersion = 0;
  const waiters: CoalescedUpdateWaiter[] = [];

  const settleWaitersThrough = (
    version: number,
    outcome: { status: "resolved" } | { reason: unknown; status: "rejected" },
  ): void => {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (waiter.version > version) {
        continue;
      }
      waiters.splice(index, 1);
      if (outcome.status === "resolved") {
        waiter.resolve();
      } else {
        waiter.reject(outcome.reason);
      }
    }
  };

  const drain = async (): Promise<void> => {
    isUpdateInFlight = true;
    shouldRestartAfterCurrentPass = false;

    try {
      while (processedVersion < requestedVersion) {
        const passVersion = requestedVersion;
        shouldRestartAfterCurrentPass = false;
        try {
          if (!(await task())) {
            return;
          }
        } catch (error) {
          processedVersion = passVersion;
          settleWaitersThrough(processedVersion, { reason: error, status: "rejected" });
          return;
        }

        processedVersion = passVersion;
        settleWaitersThrough(processedVersion, { status: "resolved" });
      }
    } finally {
      isUpdateInFlight = false;
      if (processedVersion < requestedVersion && shouldRestartAfterCurrentPass) {
        void drain();
      }
    }
  };

  return (): Promise<void> => {
    const requestVersion = ++requestedVersion;
    const completed = new Promise<void>((resolve, reject) => {
      waiters.push({ reject, resolve, version: requestVersion });
    });

    if (isUpdateInFlight) {
      shouldRestartAfterCurrentPass = true;
    } else {
      void drain();
    }

    return completed;
  };
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
