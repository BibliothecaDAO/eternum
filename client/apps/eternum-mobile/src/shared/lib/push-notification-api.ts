// Here we create a utility to handle sending push notification subscriptions to the server
// This is a client-side implementation - you would need a corresponding server implementation

const SERVER_URL = import.meta.env.VITE_PUSH_SERVER_URL || "http://localhost:3000";
/**
 * Save a push subscription to the server
 * @param subscription PushSubscription object from the browser
 * @returns Promise that resolves to the server response
 */
export async function saveSubscription(subscription: PushSubscription): Promise<Response> {
  const response = await fetch(`${SERVER_URL}/api/save-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription),
  });

  return response;
}

/**
 * Remove a push subscription from the server
 * @param subscription PushSubscription object from the browser
 * @returns Promise that resolves to the server response
 */
export async function removeSubscription(subscription: PushSubscription): Promise<Response> {
  const response = await fetch(`${SERVER_URL}/api/remove-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
    }),
  });

  return response;
}

/**
 * Test sending a push notification directly (for debugging)
 * @param subscription PushSubscription object from the browser
 * @returns Promise that resolves to the server response
 */
export async function testPushNotification(subscription: PushSubscription): Promise<Response> {
  // Simple notification object - minimizing complexity
  const simpleNotification = {
    title: "Test Notification",
    body: "This is a test notification from Eternum at " + new Date().toLocaleTimeString(),
    icon: "/game-pwa-192x192.png",
  };

  const response = await fetch(`${SERVER_URL}/api/test-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription,
      notification: simpleNotification,
    }),
  });

  return response;
}
