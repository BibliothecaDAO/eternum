import { captureError as postHogCaptureError, captureSystemError as postHogCaptureSystemError } from "@/posthog";
import { getCurrentSpan, recordError as recordSpanError, getCurrentTraceId, addEvent } from "../tracer";

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  realmId?: string;
  sessionId?: string;
  gameState?: any;
  networkState?: any;
  [key: string]: any;
}

export interface TracedError extends Error {
  traceId?: string;
  spanId?: string;
  timestamp: number;
  errorType: "system" | "network" | "game" | "render" | "unknown";
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  type: "navigation" | "click" | "api" | "state" | "custom";
  category: string;
  message: string;
  data?: Record<string, any>;
}

class ErrorReporter {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private errorHandlers: Map<string, (error: TracedError) => void> = new Map();

  constructor() {
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.reportError(new Error(event.reason), {
        errorType: "system",
        context: {
          type: "unhandledrejection",
          promise: event.promise,
        },
      });
    });

    // Handle global errors
    window.addEventListener("error", (event) => {
      this.reportError(event.error || new Error(event.message), {
        errorType: "system",
        context: {
          type: "global_error",
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  public reportError(
    error: Error | unknown,
    options: {
      errorType?: TracedError["errorType"];
      context?: ErrorContext;
      fatal?: boolean;
    } = {},
  ): void {
    const errorType = options.errorType || this.classifyError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Create traced error object
    const tracedError: TracedError = {
      name: error instanceof Error ? error.name : "Error",
      message: errorMessage,
      stack: errorStack,
      traceId: getCurrentTraceId(),
      spanId: getCurrentSpan()?.spanContext().spanId,
      timestamp: Date.now(),
      errorType,
      context: options.context || {},
      breadcrumbs: [...this.breadcrumbs],
    };

    // Record in current span
    if (error instanceof Error) {
      recordSpanError(error, {
        "error.type": errorType,
        "error.fatal": options.fatal || false,
        ...options.context,
      });
    }

    // Add error event to span
    addEvent("error.reported", {
      "error.message": errorMessage,
      "error.type": errorType,
      "error.stack": errorStack,
      ...options.context,
    });

    // Send to PostHog
    if (error instanceof Error) {
      postHogCaptureError(error, {
        traceId: tracedError.traceId,
        errorType,
        breadcrumbs: this.breadcrumbs.slice(-10), // Last 10 breadcrumbs
        ...options.context,
      });
    } else {
      postHogCaptureSystemError(error, {
        traceId: tracedError.traceId,
        errorType,
        breadcrumbs: this.breadcrumbs.slice(-10),
        ...options.context,
      });
    }

    // Execute custom error handlers
    this.errorHandlers.forEach((handler) => {
      try {
        handler(tracedError);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.group(`🔴 ${errorType.toUpperCase()} ERROR`);
      console.error("Error:", error);
      console.log("Trace ID:", tracedError.traceId);
      console.log("Context:", options.context);
      console.log("Breadcrumbs:", this.breadcrumbs.slice(-5));
      console.groupEnd();
    }
  }

  private classifyError(error: unknown): TracedError["errorType"] {
    if (!error) return "unknown";

    const errorString = String(error).toLowerCase();
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : errorString;

    // Network errors
    if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("cors") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("socket") ||
      errorMessage.includes("websocket")
    ) {
      return "network";
    }

    // Rendering errors
    if (
      errorMessage.includes("webgl") ||
      errorMessage.includes("canvas") ||
      errorMessage.includes("three") ||
      errorMessage.includes("render") ||
      errorMessage.includes("gpu")
    ) {
      return "render";
    }

    // Game logic errors
    if (
      errorMessage.includes("game") ||
      errorMessage.includes("realm") ||
      errorMessage.includes("army") ||
      errorMessage.includes("resource") ||
      errorMessage.includes("trade")
    ) {
      return "game";
    }

    // System errors
    if (errorMessage.includes("dojo") || errorMessage.includes("starknet") || errorMessage.includes("system")) {
      return "system";
    }

    return "unknown";
  }

  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, "timestamp">): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: Date.now(),
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Trim breadcrumbs if exceeding max
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    // Add to current span as event
    addEvent("breadcrumb", {
      type: breadcrumb.type,
      category: breadcrumb.category,
      message: breadcrumb.message,
      ...breadcrumb.data,
    });
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  public getBreadcrumbs(): ReadonlyArray<Breadcrumb> {
    return this.breadcrumbs;
  }

  public addErrorHandler(name: string, handler: (error: TracedError) => void): void {
    this.errorHandlers.set(name, handler);
  }

  public removeErrorHandler(name: string): void {
    this.errorHandlers.delete(name);
  }

  // Specific error reporting methods
  public reportNetworkError(
    error: Error,
    request: {
      url: string;
      method?: string;
      status?: number;
      duration?: number;
    },
  ): void {
    this.reportError(error, {
      errorType: "network",
      context: {
        url: request.url,
        method: request.method,
        status: request.status,
        duration: request.duration,
        type: "network_request",
      },
    });
  }

  public reportGameError(
    error: Error,
    gameContext: {
      action: string;
      entityId?: string;
      realmId?: string;
      coordinates?: { x: number; y: number };
      [key: string]: any;
    },
  ): void {
    this.reportError(error, {
      errorType: "game",
      context: {
        ...gameContext,
        type: "game_action",
      },
    });
  }

  public reportRenderError(
    error: Error,
    renderContext: {
      scene?: string;
      object?: string;
      fps?: number;
      memory?: number;
    },
  ): void {
    this.reportError(error, {
      errorType: "render",
      context: {
        ...renderContext,
        type: "render_error",
      },
    });
  }

  public reportSystemError(
    error: Error,
    systemContext: {
      system: string;
      method: string;
      params?: any;
    },
  ): void {
    this.reportError(error, {
      errorType: "system",
      context: {
        ...systemContext,
        type: "system_call",
      },
    });
  }
}

// Create singleton instance
export const errorReporter = new ErrorReporter();

// Export convenience functions
export const reportError = errorReporter.reportError.bind(errorReporter);
export const addBreadcrumb = errorReporter.addBreadcrumb.bind(errorReporter);
export const reportNetworkError = errorReporter.reportNetworkError.bind(errorReporter);
export const reportGameError = errorReporter.reportGameError.bind(errorReporter);
export const reportRenderError = errorReporter.reportRenderError.bind(errorReporter);
export const reportSystemError = errorReporter.reportSystemError.bind(errorReporter);
