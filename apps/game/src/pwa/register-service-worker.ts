type UpdateReady = (apply: () => Promise<void>) => void;

/** Keeps the update action available without reloading other tabs when one player accepts it. */
export function registerGameServiceWorker(onUpdateReady: UpdateReady): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let observedWorker: ServiceWorker | null = null;
  const cleanups: Array<() => void> = [];
  const offerUpdate = () => {
    if (!disposed && registration?.active && registration.waiting) onUpdateReady(() => activateUpdate(registration!));
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
      offerUpdate();
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

function reportRegistrationFailure(error: unknown): void {
  console.error("pwa_registration_failed", error);
}
