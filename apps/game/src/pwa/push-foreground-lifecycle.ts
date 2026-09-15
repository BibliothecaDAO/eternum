import { syncPushGameForeground } from "./push-notification-client";

const FOREGROUND_REFRESH_MS = 20_000;
const FOREGROUND_EVENTS = [
  "focus",
  "online",
  "pageshow",
  "pagehide",
  "popstate",
  "urlChanged",
  "pushRegistrationChanged",
] as const;

/** Keeps one coalesced presence request in flight and refreshes the crash-safe server lease while the app runs. */
export function startPushForegroundLifecycle(owner: string): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  let disposed = false;
  let running = false;
  let requested = false;
  let reportedFailure = false;

  const runRequestedSyncs = async () => {
    while (requested && !disposed) {
      requested = false;
      try {
        await syncPushGameForeground(owner);
        reportedFailure = false;
      } catch {
        if (!reportedFailure) console.warn("push_game_foreground_sync_failed");
        reportedFailure = true;
      }
    }
    running = false;
  };

  const requestSync = () => {
    requested = true;
    if (running) return;
    running = true;
    void runRequestedSyncs();
  };

  requestSync();
  const refresh = window.setInterval(requestSync, FOREGROUND_REFRESH_MS);
  document.addEventListener("visibilitychange", requestSync);
  FOREGROUND_EVENTS.forEach((event) => window.addEventListener(event, requestSync));

  return () => {
    disposed = true;
    window.clearInterval(refresh);
    document.removeEventListener("visibilitychange", requestSync);
    FOREGROUND_EVENTS.forEach((event) => window.removeEventListener(event, requestSync));
  };
}
