/// <reference types="vite-plugin-pwa/client" />

import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";

import App from "./app";
import { env } from "../env";

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

window.Buffer = Buffer;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("React root not found");
}

const sentryEnabled = import.meta.env.PROD && Boolean(env.VITE_PUBLIC_SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: env.VITE_PUBLIC_SENTRY_DSN,
    sendDefaultPii: env.VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: env.VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    replaysSessionSampleRate: env.VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: env.VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    environment: env.VITE_PUBLIC_SENTRY_ENVIRONMENT || env.VITE_PUBLIC_CHAIN || "development",
    release: env.VITE_PUBLIC_GAME_VERSION || undefined,
  });
}

const root = ReactDOM.createRoot(rootElement as HTMLElement, {
  onRecoverableError: sentryEnabled
    ? (error, errorInfo) => {
        Sentry.captureException(error, {
          extra: {
            componentStack: (errorInfo as { componentStack?: string } | undefined)?.componentStack,
          },
        });
      }
    : undefined,
});

root.render(
  <React.StrictMode>
    {sentryEnabled ? (
      <Sentry.ErrorBoundary fallback={<div />}>
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
