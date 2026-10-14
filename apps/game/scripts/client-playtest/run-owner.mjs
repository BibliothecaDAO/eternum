/**
 * The one owner of everything a playtest invocation starts: the build, the preview, each browser, its DevTools
 * connection and temporary profile. A cancel (a signal) is a request: work stops at its next checkpoint and unwinds
 * through the same evidence-and-cleanup path as a normal end. Resources are released last-acquired first, each awaited.
 */
export class Cancelled extends Error {
  constructor(reason) {
    super(`cancelled: ${reason}`);
    this.name = "Cancelled";
  }
}

export function createRunOwner() {
  const resources = [];
  const releaseFailures = [];
  const cancelWaiters = new Set();
  let cancelledBy = null;

  const releaseEntry = async (entry) => {
    const index = resources.indexOf(entry);
    if (index === -1) return;
    resources.splice(index, 1);
    try {
      await entry.release();
    } catch (error) {
      releaseFailures.push(`${entry.name}: ${error.message}`);
    }
  };

  return {
    get cancelledBy() {
      return cancelledBy;
    },
    get releaseFailures() {
      return [...releaseFailures];
    },
    /** Takes ownership of a started resource; the returned release frees it now (once). */
    adopt(name, release) {
      const entry = { name, release };
      resources.push(entry);
      return () => releaseEntry(entry);
    },
    held: () => resources.map((entry) => entry.name),
    cancel(reason) {
      if (cancelledBy) return;
      cancelledBy = reason;
      for (const wake of cancelWaiters) wake();
    },
    throwIfCancelled() {
      if (cancelledBy) throw new Cancelled(cancelledBy);
    },
    /** Waits `ms`, or less if the run is cancelled meanwhile, then throws if it was. */
    async sleep(ms) {
      await new Promise((resolveSleep) => {
        const done = () => {
          clearTimeout(timer);
          cancelWaiters.delete(done);
          resolveSleep();
        };
        const timer = setTimeout(done, ms);
        cancelWaiters.add(done);
        if (cancelledBy) done();
      });
      if (cancelledBy) throw new Cancelled(cancelledBy);
    },
    async releaseAll() {
      for (const entry of [...resources].reverse()) await releaseEntry(entry);
    },
  };
}
