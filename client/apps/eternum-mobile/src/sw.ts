/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Basic variable to cache the assets
const CACHE_NAME = "eternum-mobile-cache-v1";
const urlsToCache = ["/", "/index.html"];

// Install event
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Opened cache");
      return cache.addAll(urlsToCache);
    }),
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activate");
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
          return null;
        }),
      );
    }),
  );
  // Ensure that the service worker takes control of the page immediately
  event.waitUntil(self.clients.claim());
});

// Define the notification data type
interface NotificationData {
  title: string;
  body: string;
  icon: string;
  data?: Record<string, any>;
}

// Push event - handle incoming push events
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push Received", event);

  let notificationData: NotificationData = {
    title: "Default Title",
    body: "Something happened!",
    icon: "/game-pwa-192x192.png",
  };

  if (event.data) {
    try {
      const data = event.data.text();
      console.log("[Service Worker] Push data:", data);
      notificationData = JSON.parse(data);
    } catch (e) {
      console.error("[Service Worker] Failed to parse push notification data:", e);

      // Try handling the data as plain text if JSON parsing fails
      try {
        if (event.data) {
          notificationData = {
            title: "New Message",
            body: event.data.text(),
            icon: "/game-pwa-192x192.png",
          };
        }
      } catch (err) {
        console.error("[Service Worker] Could not handle data as text either:", err);
      }
    }
  } else {
    console.warn("[Service Worker] Push event but no data");
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || "/game-pwa-192x192.png", // Fallback icon
    badge: "/game-pwa-64x64.png",
    vibrate: [100, 50, 100],
    tag: "eternum-notification-" + Date.now(), // Ensure uniqueness
    renotify: true, // Force notification even for same tag
    requireInteraction: true, // Keep notification visible until user interacts
    data: notificationData.data || {},
  };

  console.log("[Service Worker] Showing notification with options:", options);

  // First check if we need to show the notification based on client focus
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Always show notification regardless of focus state
        console.log("[Service Worker] Client list:", clientList);
        console.log("[Service Worker] Proceeding to show notification regardless of focus");

        return self.registration
          .showNotification(notificationData.title, options)
          .then(() => {
            console.log("[Service Worker] Notification shown successfully");
          })
          .catch((error) => {
            console.error("[Service Worker] Error showing notification:", error);
          });
      }),
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click received:", event);

  event.notification.close();

  // Open the app and navigate to a specific page when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      console.log("[Service Worker] Found clients:", clientList.length);
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        console.log("[Service Worker] Client URL:", client.url);
        if (client.url === "/" && "focus" in client) {
          console.log("[Service Worker] Focusing existing client");
          return client.focus();
        }
      }

      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        const url = event.notification.data?.url || "/";
        console.log("[Service Worker] Opening new window:", url);
        return clients.openWindow(url);
      }
    }),
  );
});
