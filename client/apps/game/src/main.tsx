/// <reference types="vite-plugin-pwa/client" />

import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";

import App from "./app";
import { resolveSentryRuntimeOptions } from "./sentry-config";
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

const sentryDsn = import.meta.env.VITE_PUBLIC_SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

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
  const sentryOptions = resolveSentryRuntimeOptions(import.meta.env);

  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: sentryOptions.sendDefaultPii,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: sentryOptions.tracesSampleRate,
    tracePropagationTargets: sentryOptions.tracePropagationTargets,
    replaysSessionSampleRate: sentryOptions.replaysSessionSampleRate,
    replaysOnErrorSampleRate: sentryOptions.replaysOnErrorSampleRate,
    environment: sentryOptions.environment,
    release: sentryOptions.release,
    beforeSend: sentryOptions.beforeSend,
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
