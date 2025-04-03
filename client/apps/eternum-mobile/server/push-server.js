/**
 * This is a simple Express server for handling Web Push notifications
 * Run with: node push-server.js
 *
 * In a production environment, you would:
 * 1. Integrate this with your main server
 * 2. Store subscriptions in a database
 * 3. Add authentication for the API endpoints
 * 4. Implement better error handling
 */

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// CORS setup
app.use(cors());
app.use(bodyParser.json());

// In-memory store for subscriptions (in production, use a database)
const subscriptions = new Map();

// VAPID keys setup (generate your own keys with webpush.generateVAPIDKeys())
const vapidKeys = {
  publicKey: "BAl0gEcSdNwJ8QhJIh8HlSGVBMkMCwPOefDD58m3ILYudAIZaFDNOKOvb0-n7zO9P5a-f2WFFBqcN7wKnN0XGqc",
  privateKey: "gXHwgTLAGqJsXnG3rBBkGfDiDkLV_EvWZhzJ2fpB90Q",
};

webpush.setVapidDetails("mailto:your-email@example.com", vapidKeys.publicKey, vapidKeys.privateKey);

// API Endpoints
app.post("/api/save-subscription", (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      success: false,
      message: "Subscription is invalid",
    });
  }

  const id = subscription.endpoint;
  subscriptions.set(id, subscription);

  console.log(`Subscription saved: ${id}`);
  console.log(`Total subscriptions: ${subscriptions.size}`);

  return res.status(201).json({
    success: true,
    message: "Subscription saved",
  });
});

app.post("/api/remove-subscription", (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({
      success: false,
      message: "Endpoint is required",
    });
  }

  if (subscriptions.has(endpoint)) {
    subscriptions.delete(endpoint);
    console.log(`Subscription removed: ${endpoint}`);
    console.log(`Total subscriptions: ${subscriptions.size}`);

    return res.status(200).json({
      success: true,
      message: "Subscription removed",
    });
  }

  return res.status(404).json({
    success: false,
    message: "Subscription not found",
  });
});

app.post("/api/test-notification", async (req, res) => {
  const { subscription, notification } = req.body;

  if (!subscription || !notification) {
    return res.status(400).json({
      success: false,
      message: "Subscription and notification are required",
    });
  }

  try {
    const result = await webpush.sendNotification(subscription, JSON.stringify(notification));
    console.log("Push notification sent:", result);

    return res.status(200).json({
      success: true,
      message: "Push notification sent",
    });
  } catch (error) {
    console.error("Error sending push notification:", error);

    return res.status(500).json({
      success: false,
      message: "Error sending push notification",
      error: error.message,
    });
  }
});

// Broadcast endpoint - send a notification to all subscriptions
app.post("/api/broadcast", async (req, res) => {
  const { notification } = req.body;

  if (!notification) {
    return res.status(400).json({
      success: false,
      message: "Notification is required",
    });
  }

  const notificationPayload = JSON.stringify(notification);
  const results = { sent: 0, failed: 0, errors: [] };

  const sendPromises = [];

  for (const [id, subscription] of subscriptions.entries()) {
    const sendPromise = webpush
      .sendNotification(subscription, notificationPayload)
      .then(() => {
        results.sent++;
      })
      .catch((error) => {
        results.failed++;
        results.errors.push({
          subscription: id,
          error: error.message,
        });

        // If the subscription is invalid, remove it
        if (error.statusCode === 410) {
          console.log(`Removing invalid subscription: ${id}`);
          subscriptions.delete(id);
        }
      });

    sendPromises.push(sendPromise);
  }

  await Promise.all(sendPromises);

  console.log(`Broadcast results: ${results.sent} sent, ${results.failed} failed`);

  return res.status(200).json({
    success: true,
    message: "Broadcast sent",
    results,
  });
});

// Game event notification - simulates sending notifications for game events
app.post("/api/game-event", async (req, res) => {
  const { event, targetUsers } = req.body;

  if (!event) {
    return res.status(400).json({
      success: false,
      message: "Event details are required",
    });
  }

  // Create notification payload based on event type
  let notification;

  switch (event.type) {
    case "attack":
      notification = {
        title: "Your realm is under attack!",
        body: `${event.attackerName} is attacking your realm`,
        icon: "/game-pwa-192x192.png",
        data: {
          url: `/realm/${event.realmId}`,
          eventType: "attack",
        },
      };
      break;
    case "resource":
      notification = {
        title: "Resources Ready!",
        body: `Your ${event.resourceName} is ready to collect`,
        icon: "/game-pwa-192x192.png",
        data: {
          url: `/realm/${event.realmId}`,
          eventType: "resource",
        },
      };
      break;
    default:
      notification = {
        title: "Eternum Update",
        body: event.message || "Something happened in your realm",
        icon: "/game-pwa-192x192.png",
        data: {
          url: "/",
        },
      };
  }

  const notificationPayload = JSON.stringify(notification);
  const results = { sent: 0, failed: 0, errors: [] };

  // If targetUsers is provided, only send to those users
  // This is a simplified example - in a real app, you'd have user IDs associated with subscriptions
  const targetSubscriptions = targetUsers
    ? Array.from(subscriptions.entries()).filter(([, sub]) => targetUsers.includes(sub.userId))
    : Array.from(subscriptions.entries());

  const sendPromises = targetSubscriptions.map(([id, subscription]) => {
    return webpush
      .sendNotification(subscription, notificationPayload)
      .then(() => {
        results.sent++;
      })
      .catch((error) => {
        results.failed++;
        results.errors.push({
          subscription: id,
          error: error.message,
        });

        if (error.statusCode === 410) {
          console.log(`Removing invalid subscription: ${id}`);
          subscriptions.delete(id);
        }
      });
  });

  await Promise.all(sendPromises);

  console.log(`Game event notification results: ${results.sent} sent, ${results.failed} failed`);

  return res.status(200).json({
    success: true,
    message: "Game event notifications sent",
    results,
  });
});

// Public VAPID key endpoint
app.get("/api/vapid-public-key", (req, res) => {
  return res.status(200).json({
    publicKey: vapidKeys.publicKey,
  });
});

app.listen(port, () => {
  console.log(`Push notification server running on port ${port}`);
});
