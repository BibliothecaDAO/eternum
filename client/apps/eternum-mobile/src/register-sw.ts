import { registerSW } from "virtual:pwa-register";

// Register the service worker
export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("[PWA] New content available, click on reload button to update.");
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
    },
    onRegistered(registration) {
      console.log("[PWA] Service worker registered:", registration);

      if (registration) {
        // Check if push manager is available
        console.log("[PWA] PushManager available:", "pushManager" in registration);

        // Add push message event listener
        navigator.serviceWorker.addEventListener("message", (event) => {
          console.log("[PWA] Message from service worker:", event.data);
        });

        // Log subscription state
        registration.pushManager.getSubscription().then((subscription) => {
          console.log("[PWA] Current push subscription:", subscription);
        });

        // Check permission state
        console.log("[PWA] Notification permission:", Notification.permission);
      }
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration error:", error);
    },
  });

  return updateSW;
}

// Function to create a test notification directly from the browser
export async function showDirectNotification() {
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission not granted");
    }
  }

  const notification = new Notification("Test Notification", {
    body: "This is a test notification from Eternum " + new Date().toLocaleTimeString(),
    icon: "/game-pwa-192x192.png",
    tag: "test-notification-" + Date.now(),
    requireInteraction: true,
  });

  notification.onclick = () => {
    console.log("Notification clicked");
    window.focus();
    notification.close();
  };

  return notification;
}
