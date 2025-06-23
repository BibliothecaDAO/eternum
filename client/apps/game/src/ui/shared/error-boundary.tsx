import { captureError } from "@/posthog";
import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Send to PostHog
    captureError(error, {
      error_boundary: true,
      component_stack: errorInfo.componentStack,
      error_info: errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen w-screen items-center justify-center bg-brown p-4">
            <div className="panel-wood max-w-md rounded-xl border p-6 text-center text-gold">
              <h2 className="mb-4 text-xl font-bold">Something went wrong</h2>
              <p className="mb-4 text-sm">An unexpected error occurred. The development team has been notified.</p>
              <button
                className="button-wood px-4 py-2"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.reload();
                }}
              >
                Reload Game
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
