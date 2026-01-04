import { context, Span, SpanKind, SpanStatusCode, trace, Tracer } from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { env } from "../../env";

export interface TracingConfig {
  serviceName?: string;
  environment?: string;
  version?: string;
  endpoint?: string;
  sampleRate?: number;
  errorSampleRate?: number;
  enabled?: boolean;
}

let tracerProvider: WebTracerProvider | null = null;
let tracer: Tracer | null = null;

const DEFAULT_CONFIG: TracingConfig = {
  serviceName: "eternum-game",
  environment: env.VITE_PUBLIC_CHAIN || "development",
  version: env.VITE_PUBLIC_GAME_VERSION || "0.0.1",
  endpoint: env.VITE_TRACING_ENDPOINT || "http://localhost:4318/v1/traces",
  sampleRate: parseFloat(env.VITE_TRACING_SAMPLE_RATE || "0.1"),
  errorSampleRate: parseFloat(env.VITE_TRACING_ERROR_SAMPLE_RATE || "1.0"),
  enabled: env.VITE_TRACING_ENABLED === true,
};

export function initTracing(config: TracingConfig = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log("Tracing is disabled");
    return;
  }

  // Create resource identifying the service
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: finalConfig.serviceName,
    [ATTR_SERVICE_VERSION]: finalConfig.version,
    "deployment.environment": finalConfig.environment,
    "game.client": "eternum",
    "game.platform": "web",
  });

  // Configure exporters and processors
  const spanProcessors = [];

  // Console exporter for development
  if (finalConfig.environment === "development") {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  // OTLP exporter for production
  if (finalConfig.endpoint) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication headers if configured
    if (env.VITE_TRACING_AUTH_HEADER) {
      headers["Authorization"] = env.VITE_TRACING_AUTH_HEADER;
    }
    if (env.VITE_DATADOG_API_KEY) {
      headers["DD-API-KEY"] = env.VITE_DATADOG_API_KEY;
    }
    if (env.VITE_NEW_RELIC_LICENSE_KEY) {
      headers["api-key"] = env.VITE_NEW_RELIC_LICENSE_KEY;
    }

    const otlpExporter = new OTLPTraceExporter({
      url: finalConfig.endpoint,
      headers,
    });

    if (finalConfig.environment === "development") {
      spanProcessors.push(new SimpleSpanProcessor(otlpExporter));
    } else {
      spanProcessors.push(new BatchSpanProcessor(otlpExporter));
    }
  }

  // Create tracer provider with processors
  tracerProvider = new WebTracerProvider({
    resource,
    sampler: {
      shouldSample: (_context, _traceId, _spanName, _spanKind, attributes) => {
        // Always sample errors
        if (attributes.error === true || attributes["error.type"]) {
          return {
            decision: 1, // RECORD_AND_SAMPLED
            attributes,
          };
        }

        // Use configured sample rate for normal operations
        const sampleRate = finalConfig.sampleRate || 0.1;
        const shouldSample = Math.random() < sampleRate;

        return {
          decision: shouldSample ? 1 : 0,
          attributes,
        };
      },
    },
    spanProcessors,
  });

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const traceHeaderUrls = (() => {
    if (!finalConfig.endpoint) return [];
    try {
      const url = new URL(finalConfig.endpoint);
      const base = `${url.origin}${url.pathname}`;
      return [new RegExp(`^${escapeRegExp(base)}`)];
    } catch {
      return [finalConfig.endpoint];
    }
  })();

  // Set global tracer provider
  tracerProvider.register({
    contextManager: new ZoneContextManager(),
  });

  // Register automatic instrumentations
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: traceHeaderUrls,
        clearTimingResources: true,
        applyCustomAttributesOnSpan: (span, request, response) => {
          // Get request size from headers if available
          if (request.headers) {
            try {
              const headers = request.headers as Headers;
              if (headers.get) {
                const contentLength = headers.get("content-length");
                if (contentLength) {
                  span.setAttribute("http.request.body.size", parseInt(contentLength, 10));
                }
              }
            } catch (e) {
              // Headers may not be accessible
            }
          }

          // Get response size if response is available
          if (response && "headers" in response) {
            try {
              const headers = (response as Response).headers;
              if (headers && headers.get) {
                const contentLength = headers.get("content-length");
                if (contentLength) {
                  span.setAttribute("http.response.body.size", parseInt(contentLength, 10));
                }
              }
            } catch (e) {
              // Headers may not be accessible
            }
          }
        },
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: traceHeaderUrls,
      }),
    ],
  });

  // Get tracer instance
  tracer = trace.getTracer(finalConfig.serviceName || "eternum-game", finalConfig.version);

  console.log("Tracing initialized with config:", finalConfig);
}

export function getTracer(): Tracer {
  if (!tracer) {
    initTracing();
  }
  return tracer || trace.getTracer("eternum-game");
}

export function startSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, any>;
    parent?: Span;
  },
): Span {
  const tracer = getTracer();
  const parentContext = options?.parent ? trace.setSpan(context.active(), options.parent) : context.active();

  return tracer.startSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    },
    parentContext,
  );
}

export function withSpan<T>(
  name: string,
  fn: (span: Span) => T,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, any>;
  },
): T {
  const span = startSpan(name, options);

  try {
    const result = context.with(trace.setSpan(context.active(), span), () => fn(span));

    if (result instanceof Promise) {
      return result
        .then((value) => {
          span.setStatus({ code: SpanStatusCode.OK });
          return value;
        })
        .catch((error) => {
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        })
        .finally(() => {
          span.end();
        }) as T;
    }

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
    throw error;
  } finally {
    if (!(fn(span) instanceof Promise)) {
      span.end();
    }
  }
}

export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

export function addEvent(name: string, attributes?: Record<string, any>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

export function setSpanAttributes(attributes: Record<string, any>): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

export function recordError(error: Error, context?: Record<string, any>): void {
  const span = getCurrentSpan();
  if (span) {
    span.recordException(error);
    if (context) {
      span.setAttributes(context);
    }
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}

export function getCurrentTraceId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
}

export function createChildSpan(name: string, attributes?: Record<string, any>): Span {
  return startSpan(name, {
    attributes,
    parent: getCurrentSpan(),
  });
}

// Utility function to measure async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: Record<string, any>,
): Promise<T> {
  return withSpan(
    name,
    async (span) => {
      span.setAttributes(attributes || {});
      const startTime = performance.now();

      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        span.setAttribute("duration_ms", duration);
        return result;
      } catch (error) {
        span.setAttribute("error", true);
        throw error;
      }
    },
    { kind: SpanKind.INTERNAL },
  );
}

// Cleanup function
export function shutdownTracing(): Promise<void> {
  if (tracerProvider) {
    return tracerProvider.shutdown();
  }
  return Promise.resolve();
}
