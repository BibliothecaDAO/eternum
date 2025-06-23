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

    // Session recording
    session_recording: {
      enabled: true,
      recordCrossOriginIframes: false,
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
      },
      // Sample rate based on environment
      sample_rate: env.VITE_PUBLIC_CHAIN === "mainnet" ? 0.1 : 1.0,
    },

    // Autocapture
    autocapture: {
      dom_event_allowlist: [],
      url_allowlist: [],
      element_allowlist: [],
    },

    // Disable features we don't need
    disable_surveys: true,
    disable_toolbar: env.VITE_PUBLIC_CHAIN === "mainnet",

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
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return;

  posthog.capture("error", {
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    ...context,
  });
};

export const captureSystemError = (error: any, context?: Record<string, any>) => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return;

  posthog.capture("system_error", {
    error_type: "dojo_system_call",
    error_message: error?.message || "Unknown system error",
    error_stack: error?.stack,
    ...context,
  });
};
