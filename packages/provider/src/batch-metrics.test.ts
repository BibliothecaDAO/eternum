import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderBatchMetrics, getProviderBatchFeatureFlags } from "./batch-metrics";

const METRICS_ENV = "ETERNUM_PROVIDER_BATCH_METRICS";
const DELAY_ENV = "ETERNUM_PROVIDER_BATCH_DELAY_MS";

let originalMetrics: string | undefined;
let originalDelay: string | undefined;

beforeEach(() => {
  originalMetrics = process.env[METRICS_ENV];
  originalDelay = process.env[DELAY_ENV];
});

afterEach(() => {
  if (originalMetrics === undefined) {
    delete process.env[METRICS_ENV];
  } else {
    process.env[METRICS_ENV] = originalMetrics;
  }

  if (originalDelay === undefined) {
    delete process.env[DELAY_ENV];
  } else {
    process.env[DELAY_ENV] = originalDelay;
  }

  vi.restoreAllMocks();
});

describe("batch metrics flags", () => {
  it("uses conservative defaults when no env vars are set", () => {
    delete process.env[METRICS_ENV];
    delete process.env[DELAY_ENV];

    expect(getProviderBatchFeatureFlags()).toEqual({
      metricsEnabled: false,
      batchDelayMs: 1000,
    });
  });

  it("parses metrics and delay env overrides", () => {
    process.env[METRICS_ENV] = "true";
    process.env[DELAY_ENV] = "45";

    expect(getProviderBatchFeatureFlags()).toEqual({
      metricsEnabled: true,
      batchDelayMs: 45,
    });
  });
});

describe("ProviderBatchMetrics", () => {
  it("does not emit logs when metrics are disabled", () => {
    delete process.env[METRICS_ENV];
    const logger = new ProviderBatchMetrics(getProviderBatchFeatureFlags());
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.log("queue.enqueued", { queueDepth: 1 });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("emits logs when metrics are enabled", () => {
    process.env[METRICS_ENV] = "1";
    const logger = new ProviderBatchMetrics(getProviderBatchFeatureFlags());
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.log("queue.enqueued", { queueDepth: 1 });

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });
});
