// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providerShutdowns: Array<ReturnType<typeof vi.fn>> = [];

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_CHAIN: "development",
    VITE_PUBLIC_GAME_VERSION: "0.0.1",
    VITE_TRACING_ENABLED: false,
    VITE_TRACING_SAMPLE_RATE: "0.1",
    VITE_TRACING_ERROR_SAMPLE_RATE: "1.0",
  },
}));

vi.mock("@opentelemetry/context-zone", () => ({
  ZoneContextManager: class {
    enable() {
      return this;
    }
  },
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {},
}));

vi.mock("@opentelemetry/instrumentation", () => ({
  registerInstrumentations: vi.fn(),
}));

vi.mock("@opentelemetry/instrumentation-fetch", () => ({
  FetchInstrumentation: class {},
}));

vi.mock("@opentelemetry/instrumentation-xml-http-request", () => ({
  XMLHttpRequestInstrumentation: class {},
}));

vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: vi.fn((attributes) => attributes),
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  BatchSpanProcessor: class {},
  ConsoleSpanExporter: class {},
  SimpleSpanProcessor: class {},
}));

vi.mock("@opentelemetry/sdk-trace-web", () => ({
  WebTracerProvider: class {
    public shutdown = vi.fn(async () => undefined);

    constructor() {
      providerShutdowns.push(this.shutdown);
    }

    register() {}
  },
}));

describe("tracing lifecycle", () => {
  beforeEach(() => {
    providerShutdowns.length = 0;
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shuts down the active provider once when cleanup is requested repeatedly", async () => {
    const { initTracing, shutdownTracing } = await import("./tracer");

    initTracing({ enabled: true, endpoint: undefined });
    await shutdownTracing();
    await shutdownTracing();

    expect(providerShutdowns).toHaveLength(1);
    expect(providerShutdowns[0]).toHaveBeenCalledTimes(1);
  });
});
