import posthog from "posthog-js";
import { env } from "../env";

export const initPostHog = () => {
  // Only initialize if we have a project API key
  if (!env.VITE_PUBLIC_POSTHOG_KEY) {
    console.log("PostHog API key not configured, skipping initialization");
    return;
  }

  posthog.init(env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",

    // Environment-specific configuration
    debug: env.VITE_PUBLIC_CHAIN !== "mainnet",

    // Capture settings
    capture_pageview: true,
    capture_pageleave: true,

    // Session recording - simplified to only include supported options
    session_recording: {
      maskAllInputs: true,
    },

    // Set properties
    loaded: (posthog) => {
      posthog.setPersonProperties({
        environment: env.VITE_PUBLIC_CHAIN || "development",
        game_client: "eternum",
        client_version: env.VITE_PUBLIC_GAME_VERSION || "unknown",
      });
    },
  });
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
