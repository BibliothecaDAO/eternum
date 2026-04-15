/// <reference types="vite-plugin-pwa/client" />

import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";

import App from "./app";
import { BootLoaderCrashFallback, markBootMilestone, setBootDocumentState } from "./ui/modules/boot-loader";

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

const sentryEnabled = import.meta.env.PROD && Boolean(import.meta.env.VITE_PUBLIC_SENTRY_DSN);

interface BootCrashBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface BootCrashBoundaryState {
  hasError: boolean;
}

class BootCrashBoundary extends React.Component<BootCrashBoundaryProps, BootCrashBoundaryState> {
  public state: BootCrashBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): BootCrashBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("BootCrashBoundary caught an error:", error, errorInfo);
  }

  public render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

if (sentryEnabled) {
  Sentry.init({
    dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
    sendDefaultPii: readBooleanEnv("VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII", false),
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: readNumberEnv("VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", 0),
    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    replaysSessionSampleRate: readNumberEnv("VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE", 0),
    replaysOnErrorSampleRate: readNumberEnv("VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE", 0),
    environment: import.meta.env.VITE_PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.VITE_PUBLIC_CHAIN || "development",
    release: import.meta.env.VITE_PUBLIC_GAME_VERSION || undefined,
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

markBootMilestone("boot_react_mount_start");
setBootDocumentState("react-mounted");

root.render(
  <React.StrictMode>
    {sentryEnabled ? (
      <Sentry.ErrorBoundary fallback={<BootLoaderCrashFallback />}>
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <BootCrashBoundary fallback={<BootLoaderCrashFallback />}>
        <App />
      </BootCrashBoundary>
    )}
  </React.StrictMode>,
);

function readBooleanEnv(key: string, fallback: boolean): boolean {
  const value = import.meta.env[key];
  if (value == null) return fallback;
  return value === "true";
}

function readNumberEnv(key: string, fallback: number): number {
  const value = import.meta.env[key];
  if (value == null || value === "") return fallback;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}
