import * as Sentry from "@sentry/react";
import { env } from "../env";

export const initSentry = () => {
  // Only initialize if we have a DSN
  if (!env.VITE_PUBLIC_SENTRY_DSN) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn: env.VITE_PUBLIC_SENTRY_DSN,
    environment: env.VITE_PUBLIC_CHAIN || "development",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: env.VITE_PUBLIC_CHAIN === "mainnet" ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: env.VITE_PUBLIC_CHAIN === "mainnet" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    
    beforeSend(event) {
      // Filter out certain errors we don't want to track
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes("ResizeObserver loop limit exceeded")) {
          return null;
        }
        if (error?.value?.includes("Non-Error promise rejection captured")) {
          return null;
        }
      }
      
      return event;
    },
    
    // Add user context
    initialScope: {
      tags: {
        component: "game-client"
      },
    },
  });
};

// Export Sentry for use in components
export { Sentry };