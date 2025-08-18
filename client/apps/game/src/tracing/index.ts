// Main tracing initialization and exports
import { env } from "../../env";
import { traceContextManager } from "./correlation/trace-context";
import { errorReporter } from "./errors/error-reporter";
import { metricsCollector } from "./performance/metrics-collector";
import { initTracing, shutdownTracing } from "./tracer";

// Re-export all modules
export * from "./correlation/trace-context";
export * from "./errors/error-reporter";
export * from "./instrumentation/dojo-instrumentation";
export * from "./instrumentation/react-instrumentation";
export * from "./instrumentation/three-instrumentation";
export * from "./instrumentation/torii-instrumentation";
export * from "./instrumentation/websocket-instrumentation";
export * from "./performance/metrics-collector";
export * from "./tracer";

// Global initialization function
export function initializeTracing(config?: {
  userId?: string;
  realmId?: string;
  enableMetricsCollection?: boolean;
  metricsInterval?: number;
}): void {
  // Initialize core tracing
  initTracing({
    serviceName: "eternum-game",
    environment: env.VITE_PUBLIC_CHAIN || "development",
    version: env.VITE_PUBLIC_GAME_VERSION || "0.0.1",
    enabled: env.VITE_TRACING_ENABLED !== false,
  });

  // Set initial context
  if (config?.userId) {
    traceContextManager.setUserId(config.userId);
  }
  if (config?.realmId) {
    traceContextManager.setRealmId(config.realmId);
  }

  // Start metrics collection
  if (config?.enableMetricsCollection !== false) {
    metricsCollector.startCollection(config?.metricsInterval || 1000);
  }

  // Set up performance alerts
  metricsCollector.onAlert("default", (metric, value, threshold) => {
    console.warn(`Performance alert: ${metric} = ${value} (threshold: ${threshold})`);
    errorReporter.addBreadcrumb({
      type: "custom",
      category: "performance",
      message: `Performance threshold exceeded: ${metric}`,
      data: { metric, value, threshold },
    });
  });

  console.log("🔍 Tracing system initialized");
}

// Global cleanup function
export async function cleanupTracing(): Promise<void> {
  metricsCollector.stopCollection();
  await shutdownTracing();
  console.log("🔍 Tracing system cleaned up");
}

// Convenience function to wrap async operations with tracing
export async function tracedOperation<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> {
  const { withSpan } = await import("./tracer");

  return withSpan(name, async (span) => {
    if (metadata) {
      span.setAttributes(metadata);
    }

    try {
      const result = await operation();
      span.setStatus({ code: 0 }); // OK
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 1, message: (error as Error).message }); // ERROR
      throw error;
    }
  });
}

// Integration helpers for common patterns
export const TracingHelpers = {
  // Wrap a function with automatic tracing
  traced<T extends (...args: any[]) => any>(fn: T, name?: string): T {
    const fnName = name || fn.name || "anonymous";

    return ((...args: Parameters<T>) => {
      return tracedOperation(
        fnName,
        () => {
          const result = fn(...args);
          return result instanceof Promise ? result : Promise.resolve(result);
        },
        {
          "function.name": fnName,
          "function.args_count": args.length,
        },
      );
    }) as T;
  },

  // Create a traced event handler
  tracedHandler(
    eventName: string,
    handler: (event: any) => void | Promise<void>,
  ): (event: any) => void | Promise<void> {
    return (event: any) => {
      traceContextManager.recordUserAction(eventName, {
        target: event?.target?.tagName,
        type: event?.type,
      });

      return tracedOperation(
        `event.${eventName}`,
        () => {
          const result = handler(event);
          return result instanceof Promise ? result : Promise.resolve(result);
        },
        {
          "event.name": eventName,
          "event.type": event?.type,
        },
      );
    };
  },

  // Measure and record a game operation
  async measureGameOperation<T>(operationName: string, operation: () => T | Promise<T>): Promise<T> {
    return metricsCollector.measureOperation(operationName, operation) as Promise<T>;
  },

  // Record a custom game metric
  recordMetric(name: string, value: number): void {
    metricsCollector.recordGameMetric({ [name]: value } as any);
  },

  // Add a breadcrumb for debugging
  addBreadcrumb(message: string, data?: Record<string, any>): void {
    errorReporter.addBreadcrumb({
      type: "custom",
      category: "app",
      message,
      data,
    });
  },
};

// Type definitions for instrumented components
export interface TracedComponent {
  displayName: string;
  traceId?: string;
}

export interface TracedOperation {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "pending" | "success" | "error";
  error?: Error;
}

// Export a default configuration object
export const defaultTracingConfig = {
  enabled: env.VITE_TRACING_ENABLED !== false,
  endpoint: env.VITE_TRACING_ENDPOINT || "http://localhost:4318/v1/traces",
  sampleRate: parseFloat(env.VITE_TRACING_SAMPLE_RATE || "0.1"),
  errorSampleRate: parseFloat(env.VITE_TRACING_ERROR_SAMPLE_RATE || "1.0"),
  metricsInterval: 1000,
  slowFrameThreshold: 33,
  slowQueryThreshold: 500,
  maxBreadcrumbs: 50,
};
