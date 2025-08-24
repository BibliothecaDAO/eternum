import { context, Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import {
  setTelemetry as setCoreTelemetry,
  setTelemetry as setProviderTelemetry,
  setTelemetry as setToriiTelemetry,
} from "@bibliothecadao/telemetry";
import { env } from "../env";

export function initOtelTelemetry() {
  if (!env.VITE_TRACING_ENABLED) return;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.VITE_TRACING_SERVICE_NAME || "eternum-game",
    [ATTR_SERVICE_VERSION]: env.VITE_PUBLIC_GAME_VERSION || "0.0.1",
    "deployment.environment": env.VITE_PUBLIC_CHAIN || "development",
    "game.client": "eternum",
    "game.platform": "web",
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.VITE_TRACING_AUTH_HEADER) headers["Authorization"] = env.VITE_TRACING_AUTH_HEADER;
  if (env.VITE_DATADOG_API_KEY) headers["DD-API-KEY"] = env.VITE_DATADOG_API_KEY;
  if (env.VITE_NEW_RELIC_LICENSE_KEY) headers["api-key"] = env.VITE_NEW_RELIC_LICENSE_KEY;

  const exporter = new OTLPTraceExporter({ url: env.VITE_TRACING_ENDPOINT, headers });

  // Use standard sampler: ParentBased + TraceIdRatio for root spans.
  // Error-keeping is handled by tail sampling in the Collector.
  const rate = Math.max(0, Math.min(1, parseFloat(env.VITE_TRACING_SAMPLE_RATE || "0.1")));
  const provider = new WebTracerProvider({
    resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(rate) }),
    spanProcessors: [new BatchSpanProcessor(exporter), new BatchSpanProcessor(new ConsoleSpanExporter())],
  });

  provider.register({ contextManager: new ZoneContextManager() });

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          // Only propagate trace headers to your own endpoints that support them
          /^https?:\/\/localhost(:\d+)?/, // Local development
          /^https?:\/\/127\.0\.0\.1(:\d+)?/, // Local development
          // Add your production domains here when needed, e.g.:
          // /^https:\/\/api\.yourdomain\.com/
        ],
        clearTimingResources: true,
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [
          // Same URLs as above
          /^https?:\/\/localhost(:\d+)?/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?/,
        ],
      }),
    ],
  });

  const tracer = trace.getTracer(
    env.VITE_TRACING_SERVICE_NAME || "eternum-game",
    env.VITE_PUBLIC_GAME_VERSION || "0.0.1",
  );

  const adapter = {
    span: async (name: string, attributes: Record<string, any> | undefined, fn: () => any) => {
      const span = tracer.startSpan(name, { attributes: attributes || {} });
      // Also log to console to keep visibility during rollout
      const start = performance.now();
      try {
        const res = await context.with(trace.setSpan(context.active(), span), fn);
        span.setStatus({ code: SpanStatusCode.OK });
        console.debug("[SPAN]", name, { ...(attributes || {}), duration_ms: Math.round(performance.now() - start) });
        return res;
      } catch (err: any) {
        span.setAttribute("error", true);
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message });
        console.debug("[SPAN_ERROR]", name, {
          ...(attributes || {}),
          error: err?.message,
          duration_ms: Math.round(performance.now() - start),
        });
        throw err;
      } finally {
        span.end();
      }
    },
    event: (name: string, attributes?: Record<string, any>) => {
      const s: Span | undefined = trace.getSpan(context.active());
      if (s) s.addEvent(name, attributes);
      console.debug("[EVENT]", name, attributes);
    },
    counter: (name: string, value: number = 1, attributes?: Record<string, any>) => {
      const s: Span | undefined = trace.getSpan(context.active());
      if (s) s.addEvent("counter", { name, value, ...(attributes || {}) });
      console.debug("[COUNTER]", name, value, attributes);
    },
  } as const;

  // Apply to all domains using existing per-package setters
  setCoreTelemetry(adapter);
  setToriiTelemetry(adapter);
  setProviderTelemetry(adapter);
}
