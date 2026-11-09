import { distributionChannel } from "@/runtime/distribution-channel";

export function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Running as an installed app: a home-screen or desktop PWA, or either store app. Nothing offers to install it. */
export function isInstalledApp(): boolean {
  return (
    distributionChannel() !== "web" ||
    !!(
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
  );
}

/**
 * Whether this page has the game's service worker. Not in the iOS app: its web view runs workers only for App-Bound
 * Domains, and the app does the worker's jobs (the offline page, push) natively. The Android app keeps it: its web push
 * is the worker's.
 */
export function runsServiceWorker(): boolean {
  return "serviceWorker" in navigator && distributionChannel() !== "app-store";
}
