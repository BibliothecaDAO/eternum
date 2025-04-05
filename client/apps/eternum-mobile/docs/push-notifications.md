# Eternum Mobile Push Notifications

This document explains how to set up and use push notifications in the Eternum Mobile PWA application.

## Overview

The push notification system consists of:

1. **Client-side PWA implementation**: Service worker, subscription management, and notification UI
2. **Server-side implementation**: Express server for storing subscriptions and sending notifications

## Prerequisites

- HTTPS is required for push notifications in production (this is a browser requirement)
- VAPID keys for Web Push API (generated with the web-push library)

## Setup

### 1. Generate VAPID Keys

You need to generate VAPID (Voluntary Application Server Identification) keys for your application:

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

Save these keys as they will be needed for both the client and server configuration.

### 2. Configure the Client

1. Update the `VAPID_PUBLIC_KEY` constant in `src/shared/components/notification-settings.tsx`
2. Make sure the environment variable `VITE_PUSH_SERVER_URL` is set to your notification server URL

### 3. Set Up the Server

1. Navigate to the server directory:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Update the VAPID keys in `push-server.js`:

```javascript
const vapidKeys = {
  publicKey: "YOUR_PUBLIC_KEY",
  privateKey: "YOUR_PRIVATE_KEY",
};

webpush.setVapidDetails(
  "mailto:your-email@example.com", // Replace with your email
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);
```

4. Start the server:

```bash
npm start
```

## How It Works

### Client-Side Flow

1. User enables notifications through the UI
2. The app requests notification permission from the browser
3. If granted, the app subscribes to push notifications via the Push API
4. The subscription is sent to the server for storage
5. The service worker listens for push events and displays notifications

### Server-Side Flow

1. Server stores push subscriptions (in a database in production)
2. When an event occurs that requires a notification, the server:
   - Creates a notification payload
   - Sends the payload to the subscribed clients using the Web Push API
3. The browser's Push Service delivers the notification to the client
4. The service worker displays the notification to the user

## API Endpoints

The server provides the following endpoints:

- `POST /api/save-subscription`: Save a new push subscription
- `POST /api/remove-subscription`: Remove a subscription
- `POST /api/test-notification`: Send a test notification to a specific subscription
- `POST /api/broadcast`: Send a notification to all subscriptions
- `POST /api/game-event`: Send game event notifications (attack, resource ready, etc.)
- `GET /api/vapid-public-key`: Get the public VAPID key

## Testing

To test push notifications locally:

1. Start the server:

```bash
cd server
npm start
```

2. Start the client in development mode:

```bash
npm run dev
```

3. Enable notifications in the app UI
4. Use the server's test endpoint to send a notification:

```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"notification": {"title": "Test", "body": "Test notification", "icon": "/game-pwa-192x192.png"}}'
```

## Production Considerations

For production, you should:

1. Store subscriptions in a database instead of memory
2. Add authentication to the API endpoints
3. Set up proper error handling and logging
4. Integrate the notification server with your main backend
5. Implement user targeting for notifications (e.g., by realm, alliance, etc.)
6. Set up metrics to track notification delivery and click-through rates

## Troubleshooting

- **Notifications don't appear**: Check browser permissions, service worker registration, and that the service worker
  received the push event
- **401 errors**: Verify your VAPID keys are correct
- **410 errors**: The subscription has expired and should be removed
- **Local testing**: Use Chrome for local testing as Firefox requires a proper SSL certificate
