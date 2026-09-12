const RECOVERY_KEY = "eternum:chunk-load-recovery";

/** A tab open across a deployment may still request a retired lazy chunk. */
export function recoverChunkLoad(
  event: Event,
  version: string,
  browser: Window = window,
  hasPendingTransaction = false,
): void {
  if (!browser.navigator.onLine || hasPendingTransaction) return;

  try {
    // Persist before navigating so a broken deployment cannot cause a reload loop.
    if (browser.sessionStorage.getItem(RECOVERY_KEY) === version) return;
    browser.sessionStorage.setItem(RECOVERY_KEY, version);
  } catch {
    // Without a durable guard, let the existing crash UI offer manual recovery.
    return;
  }

  event.preventDefault();
  browser.location.reload();
}
