const DEFAULT_BATCH_DELAY_MS = 1000;

export interface ProviderBatchFeatureFlags {
  metricsEnabled: boolean;
  batchDelayMs: number;
}

const getEnvVar = (name: string): string | undefined => {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[name];
};

const parseBooleanFlag = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const parseBatchDelay = (value: string | undefined): number => {
  if (!value) return DEFAULT_BATCH_DELAY_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_BATCH_DELAY_MS;
  }
  return Math.floor(parsed);
};

export const getProviderBatchFeatureFlags = (): ProviderBatchFeatureFlags => {
  return {
    metricsEnabled: parseBooleanFlag(getEnvVar("ETERNUM_PROVIDER_BATCH_METRICS")),
    batchDelayMs: parseBatchDelay(getEnvVar("ETERNUM_PROVIDER_BATCH_DELAY_MS")),
  };
};

type MetricPrimitive = string | number | boolean | null | undefined;
type MetricPayload = Record<string, MetricPrimitive>;

export class ProviderBatchMetrics {
  constructor(private readonly flags: ProviderBatchFeatureFlags) {}

  get batchDelayMs(): number {
    return this.flags.batchDelayMs;
  }

  log(event: string, payload: MetricPayload): void {
    if (!this.flags.metricsEnabled) {
      return;
    }

    console.info("[provider][batch-metrics]", {
      event,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
