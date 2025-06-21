# PostHog Analytics & Error Reporting Setup

This document explains how to set up PostHog analytics and error reporting for the Eternum game client.

## Setup Instructions

1. **Create a PostHog Project**
   - Go to [posthog.com](https://posthog.com) and create a new project
   - Copy the Project API Key from your project settings
   - Note your PostHog instance URL (default: https://us.i.posthog.com)

2. **Configure Environment Variables**
   - Copy `.env.local.sample` to `.env.local`
   - Add your PostHog configuration:
     ```
     VITE_PUBLIC_POSTHOG_KEY=phc_your-project-api-key
     VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
     ```

3. **Environment-Specific Configuration**
   - The integration automatically configures different settings for development vs production
   - Production uses lower sample rates for session recording and events
   - Development environments have debug mode enabled

## Features Included

- **Error Reporting**: Automatic capture and reporting of JavaScript errors
- **React Error Boundaries**: Catches and reports React component errors
- **System Call Error Reporting**: Reports Dojo system call errors with context
- **Session Recording**: Records user sessions for debugging (with privacy controls)
- **Performance Monitoring**: Tracks user interactions and page performance
- **Custom Event Tracking**: Capture game-specific events and user actions
- **Environment Context**: Automatically includes environment and version information

## Configuration

The PostHog integration is configured in `src/posthog.ts` with:
- Environment-based sample rates (lower for production)
- Privacy-focused session recording settings
- Automatic person properties (environment, client version, etc.)
- Custom error capture functions for different error types

## Error Boundary

The `ErrorBoundary` component provides:
- Automatic error catching for React components
- Fallback UI with game-themed styling
- Reload button to recover from errors
- Automatic error reporting to PostHog with component stack traces

## Error Reporting Functions

The integration provides utility functions for manual error reporting:

```typescript
import { captureError, captureSystemError } from "@/posthog";

// Capture generic errors
captureError(new Error("Something went wrong"), {
  context: "additional context",
  user_action: "button_click"
});

// Capture system/Dojo errors
captureSystemError(error, {
  system_name: "trading_system",
  error_context: "trade_execution"
});
```

## Testing

To test the error reporting:
1. Set up PostHog API key in your environment
2. Add a test error in a component (e.g., `throw new Error("Test error")`)
3. Check your PostHog dashboard under "Events" for the reported error
4. Check "Session recordings" to see the error in context

## Discord Integration

To pipe errors and events to Discord:
1. Set up PostHog webhooks in your project settings
2. Configure a webhook to send events to your Discord channel via webhook URL
3. Filter events to only send critical errors and important game events
4. Use PostHog's Zapier integration for more advanced Discord notifications

## Privacy Considerations

- Session recording masks all inputs by default (including passwords and emails)
- Performance monitoring uses sampling to reduce overhead in production
- Person profiles are only created for identified users
- No sensitive game data (private keys, personal info) is included in events
- Cross-origin iframe recording is disabled for security

## Analytics Events

The integration automatically captures:
- Page views and navigation
- Error events with full context
- System call failures
- Component crashes with React error boundaries

You can extend this by adding custom events for game actions:

```typescript
import { posthog } from "@/posthog";

// Track game-specific events
posthog.capture("trade_completed", {
  resource_type: "wood",
  quantity: 100,
  realm_id: "0x123"
});
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_PUBLIC_POSTHOG_KEY` | PostHog project API key | Yes | - |
| `VITE_PUBLIC_POSTHOG_HOST` | PostHog instance URL | No | https://us.i.posthog.com |

## Troubleshooting

- **Events not showing up**: Check that your API key is correct and properly set
- **Session recordings not working**: Ensure you're on HTTPS (required for session recording)
- **Too many events**: Adjust sample rates in `posthog.ts` configuration
- **Privacy concerns**: Review and adjust the masking configuration in the session recording settings