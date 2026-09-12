/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { installNotificationWorker } from "./pwa/notification-worker";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
installNotificationWorker(self);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  if (!isGameNavigation(event.request)) return;
  event.respondWith(loadOnlinePageOrOfflineShell(event.request));
});

function isGameNavigation(request: Request): boolean {
  const url = new URL(request.url);
  if (request.mode !== "navigate" || url.origin !== self.location.origin) return false;
  return /^\/(?:$|(?:play|enter|factory|debug|lab)(?:\/|$)|(?:index\.html|learn|news|profile|markets|amm|leaderboard|biome-lab|local-lab)$)/.test(
    url.pathname,
  );
}

async function loadOnlinePageOrOfflineShell(request: Request): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    // No HTML cache: a retired lazy chunk can still recover by reloading the current deployment.
    const response = await fetch(request, { cache: "no-store", signal: controller.signal });
    if (response.status < 500) return response;
  } catch {
    // Offline, timed out, or unreachable: only the dedicated offline document is available locally.
  } finally {
    clearTimeout(timeout);
  }
  return (await matchPrecache("offline.html")) ?? Response.error();
}
