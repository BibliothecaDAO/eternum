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
