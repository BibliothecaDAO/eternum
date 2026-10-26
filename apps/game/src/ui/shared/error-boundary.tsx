import * as Sentry from "@sentry/react";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import React, { Component, ReactNode } from "react";
import {
  isDynamicImportChunkError,
  shouldAttemptDynamicImportRecovery,
} from "./error-boundary.dynamic-import-recovery";

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

    Sentry.captureException(error, {
      tags: { error_boundary: true, dynamic_import_error: isDynamicImportError },
      extra: {
        dynamic_import_auto_reload: shouldAutoReload,
        component_stack: errorInfo.componentStack,
      },
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
      const description = isDynamicImportError ? "The game was updated. Reload." : "Something went wrong.";
      const buttonLabel = isDynamicImportError ? "Reload Latest Assets" : "Reload Game";

      return (
        this.props.fallback || (
          <div className="flex h-screen w-screen items-center justify-center bg-hud-dark p-4">
            <HudPanel collapsible={false} className="max-w-md">
              <div className="flex flex-col items-center gap-4 p-2 text-center">
                <h2 className="text-hud-display text-hud-ink">{title}</h2>
                <p className="text-hud-body text-hud-muted">{description}</p>
                <HudButton
                  kind="primary"
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                    window.location.reload();
                  }}
                >
                  {buttonLabel}
                </HudButton>
              </div>
            </HudPanel>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
