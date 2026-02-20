import { captureError } from "@/posthog";
import React, { Component, ReactNode } from "react";
import { isDynamicImportChunkError, shouldAttemptDynamicImportRecovery } from "./error-boundary.dynamic-import-recovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isDynamicImportError = isDynamicImportChunkError(error);
    const shouldAutoReload = isDynamicImportError && shouldAttemptDynamicImportRecovery(getSessionStorage());

    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Send to PostHog
    captureError(error, {
      error_boundary: true,
      dynamic_import_error: isDynamicImportError,
      dynamic_import_auto_reload: shouldAutoReload,
      component_stack: errorInfo.componentStack,
      error_info: errorInfo,
    });

    if (shouldAutoReload) {
      console.warn("[ErrorBoundary] Recovering from dynamic import error via page reload.");
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError = isDynamicImportChunkError(this.state.error);
      const title = isDynamicImportError ? "Game update detected" : "Something went wrong";
      const description = isDynamicImportError
        ? "A game update changed some files while this tab was open. Reload to fetch the latest assets."
        : "An unexpected error occurred. The development team has been notified.";
      const buttonLabel = isDynamicImportError ? "Reload Latest Assets" : "Reload Game";

      return (
        this.props.fallback || (
          <div className="flex h-screen w-screen items-center justify-center bg-brown p-4">
            <div className="panel-wood max-w-md rounded-xl border p-6 text-center text-gold">
              <h2 className="mb-4 text-xl font-bold">{title}</h2>
              <p className="mb-4 text-sm">{description}</p>
              <button
                className="button-wood px-4 py-2"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.reload();
                }}
              >
                {buttonLabel}
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
