import posthog from "posthog-js";
import { env } from "../env";

export const captureClientEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(eventName, properties);
};

// Utility functions for error reporting
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return;

  posthog.capture("error", {
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    ...context,
  });
};

export const captureSystemError = (error: unknown, context?: Record<string, unknown>) => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return;

  const errorMessage = error instanceof Error ? error.message : "Unknown system error";
  const errorStack = error instanceof Error ? error.stack : undefined;

  posthog.capture("system_error", {
    error_type: "dojo_system_call",
    error_message: errorMessage,
    error_stack: errorStack,
    ...context,
  });
};
