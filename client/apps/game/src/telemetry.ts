import {
  setTelemetry as setCoreTelemetry,
  setTelemetry as setProviderTelemetry,
  setTelemetry as setToriiTelemetry,
} from "@bibliothecadao/telemetry";

import { env } from "../env";

export function initCoreTelemetry() {
  if (!env.VITE_TRACING_ENABLED) return;

  const adapter = {
    span: async (name: string, attributes: Record<string, any>, fn: () => Promise<any>) => {
      const start = performance.now();
      try {
        const res = await fn();
        // Keep logs concise to avoid noise
        console.debug("[SPAN]", name, { ...attributes, duration_ms: Math.round(performance.now() - start) });
        return res;
      } catch (err) {
        console.debug("[SPAN_ERROR]", name, {
          ...attributes,
          error: (err as Error)?.message,
          duration_ms: Math.round(performance.now() - start),
        });
        throw err;
      }
    },
    event: (name: string, attributes: Record<string, any>) => {
      console.debug("[EVENT]", name, attributes);
    },
    counter: (name: string, value = 1, attributes: Record<string, any>) => {
      console.debug("[COUNTER]", name, value, attributes);
    },
  } as const;

  // Apply to core, torii (sync), and provider (tx)
  setCoreTelemetry(adapter);
  setToriiTelemetry(adapter);
  setProviderTelemetry(adapter);
}
