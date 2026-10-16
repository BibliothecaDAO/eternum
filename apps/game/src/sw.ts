/// <reference lib="webworker" />
import * as Effect from "effect/Effect";
import * as Data from "effect/Data";
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { installNotificationWorker } from "./pwa/notification-worker";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  /** Stamped at build time by the release plugin. */
  REALMS_RELEASE?: string;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
installNotificationWorker(self);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "RELEASE") event.ports[0]?.postMessage(self.REALMS_RELEASE ?? null);
});

self.addEventListener("fetch", (event) => {
  if (!isGameNavigation(event.request)) return;
  event.respondWith(loadOnlinePageOrOfflineShell(event.request));
});

function isGameNavigation(request: Request): boolean {
  const url = new URL(request.url);
  if (request.mode !== "navigate" || url.origin !== self.location.origin) return false;
  return /^\/(?:$|(?:g|p|scroll|debug|lab)(?:\/|$)|(?:index\.html|play|results|account|learn|news|terms|privacy)$)/.test(
    url.pathname,
  );
}

class NavigationUnavailable extends Data.TaggedError("NavigationUnavailable")<{ cause?: unknown }> {}

function loadOnlinePageOrOfflineShell(request: Request): Promise<Response> {
  const online = Effect.tryPromise({
    // No HTML cache: a retired lazy chunk can recover by reloading the current deployment.
    try: (signal) => fetch(request, { cache: "no-store", signal }),
    catch: (cause) => new NavigationUnavailable({ cause }),
  }).pipe(
    Effect.timeoutOrElse({ duration: 8_000, orElse: () => Effect.fail(new NavigationUnavailable({})) }),
    Effect.flatMap((response) =>
      response.status < 500 ? Effect.succeed(response) : Effect.fail(new NavigationUnavailable({})),
    ),
    Effect.catchTag("NavigationUnavailable", () =>
      Effect.promise(async () => (await matchPrecache("offline.html")) ?? Response.error()),
    ),
  );
  return Effect.runPromise(online);
}
