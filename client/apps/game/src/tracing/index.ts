import { env } from "../../env";
import { traceContextManager } from "./correlation/trace-context";
import { errorReporter } from "./errors/error-reporter";
import { metricsCollector } from "./performance/metrics-collector";
import { initTracing, shutdownTracing } from "./tracer";

export * from "./correlation/trace-context";
export * from "./errors/error-reporter";
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
