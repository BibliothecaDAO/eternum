type UpdateReady = (apply: () => Promise<void>) => void;

const RELEASE_ANSWER_MS = 3_000;

/**
 * Keeps the update action available without reloading other tabs when one player accepts it. A waiting worker is
 * offered once, and only when it serves a different release than the running page: a page loaded after a deploy
 * already runs the new client while the previous worker still controls it.
 */
export function registerGameServiceWorker(runningRelease: string, onUpdateReady: UpdateReady): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let observedWorker: ServiceWorker | null = null;
  let consideredWorker: ServiceWorker | null = null;
  const cleanups: Array<() => void> = [];
  const offerUpdate = async () => {
    const waiting = registration?.active ? registration.waiting : null;
    if (disposed || !waiting || waiting === consideredWorker) return;
    consideredWorker = waiting;
    const release = await askRelease(waiting);
    if (!disposed && release !== runningRelease) onUpdateReady(() => activateUpdate(registration!));
  };
  const observeInstall = () => {
    observedWorker?.removeEventListener("statechange", offerUpdate);
    observedWorker = registration?.installing ?? null;
    observedWorker?.addEventListener("statechange", offerUpdate);
  };
  const checkForUpdate = () => {
    if (navigator.onLine) void registration?.update().catch(reportRegistrationFailure);
  };

  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registered) => {
      if (disposed) return;
      registration = registered;
      registered.addEventListener("updatefound", observeInstall);
      cleanups.push(() => registered.removeEventListener("updatefound", observeInstall));
      observeInstall();
      void offerUpdate();
      window.addEventListener("focus", checkForUpdate);
      cleanups.push(() => window.removeEventListener("focus", checkForUpdate));
    })
    .catch(reportRegistrationFailure);

  return () => {
    disposed = true;
    observedWorker?.removeEventListener("statechange", offerUpdate);
    for (const cleanup of cleanups) cleanup();
  };
}

async function activateUpdate(registration: ServiceWorkerRegistration): Promise<void> {
  const waiting = registration.waiting;
  if (waiting) {
    await new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (waiting.state === "activated") {
          cleanup();
          resolve();
        } else if (waiting.state === "redundant") {
          cleanup();
          reject(new Error("Update was superseded"));
        }
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Update activation timed out"));
      }, 10_000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        waiting.removeEventListener("statechange", changed);
      };
      waiting.addEventListener("statechange", changed);
      waiting.postMessage({ type: "SKIP_WAITING" });
      changed();
    });
  }
}

/** The release a worker serves; null when it cannot say (a worker built before releases were stamped). */
function askRelease(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), RELEASE_ANSWER_MS);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(typeof event.data === "string" ? event.data : null);
    };
    worker.postMessage({ type: "RELEASE" }, [channel.port2]);
  });
}

function reportRegistrationFailure(error: unknown): void {
  console.error("pwa_registration_failed", error);
}
