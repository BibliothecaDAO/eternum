type ClientActionLatencyPhase = "click" | "submitted" | "pre_confirmed" | "rendered";

export interface ClientActionLatencyMeasurement {
  actionId: string;
  operation: string;
  surface: string;
  entityId?: number;
  targetHex?: { col: number; row: number };
  transactionHash?: string;
  phases: Partial<Record<ClientActionLatencyPhase, number>>;
  failedReason?: string;
}

export interface ClientActionLatencySummary {
  completed: number;
  operation?: string;
  p50ClickToRenderedMs: number;
  p95ClickToRenderedMs: number;
  samplesMs: number[];
}

interface ClientActionLatencyTarget {
  __clientActionLatencyMeasurements?: ClientActionLatencyMeasurement[];
  __clientActionLatencySummary?: ClientActionLatencySummary;
}

const MAX_MEASUREMENTS = 400;
let nextActionSequence = 0;
let measurements: ClientActionLatencyMeasurement[] = [];

const now = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

const normalizeTransactionHash = (hash: string): string => {
  try {
    return `0x${BigInt(hash).toString(16)}`;
  } catch {
    return hash.toLowerCase();
  }
};

const publish = (): void => {
  if (typeof globalThis === "undefined") return;
  const target = globalThis as ClientActionLatencyTarget;
  target.__clientActionLatencyMeasurements = snapshotClientActionLatency();
  target.__clientActionLatencySummary = summarizeClientActionLatency("explore_reveal");
};

const updateMeasurement = (
  actionId: string,
  update: (measurement: ClientActionLatencyMeasurement) => ClientActionLatencyMeasurement,
): void => {
  measurements = measurements.map((measurement) =>
    measurement.actionId === actionId ? update(measurement) : measurement,
  );
  publish();
};

const findActionIdByTransactionHash = (transactionHash: string): string | undefined => {
  const normalizedHash = normalizeTransactionHash(transactionHash);
  return measurements.findLast(
    (measurement) =>
      measurement.transactionHash !== undefined &&
      normalizeTransactionHash(measurement.transactionHash) === normalizedHash,
  )?.actionId;
};

export function beginClientActionLatency(input: {
  operation: string;
  surface: string;
  entityId?: number;
  targetHex?: { col: number; row: number };
}): string {
  nextActionSequence += 1;
  const actionId = `${Date.now()}-${nextActionSequence}`;
  measurements = [
    ...measurements,
    {
      actionId,
      operation: input.operation,
      surface: input.surface,
      entityId: input.entityId,
      targetHex: input.targetHex,
      phases: { click: now() },
    },
  ].slice(-MAX_MEASUREMENTS);
  publish();
  return actionId;
}

export function recordClientActionSubmitted(actionId: string, transactionHash: string): void {
  updateMeasurement(actionId, (measurement) => ({
    ...measurement,
    transactionHash,
    phases: { ...measurement.phases, submitted: now() },
  }));
}

export function recordClientActionPreConfirmed(transactionHash: string): void {
  const actionId = findActionIdByTransactionHash(transactionHash);
  if (!actionId) return;
  updateMeasurement(actionId, (measurement) => ({
    ...measurement,
    phases: { ...measurement.phases, pre_confirmed: now() },
  }));
}

export function recordClientActionRendered(actionId: string): void {
  updateMeasurement(actionId, (measurement) => ({
    ...measurement,
    phases: { ...measurement.phases, rendered: now() },
  }));
}

export function recordClientActionFailed(actionId: string, error: unknown): void {
  const failedReason = error instanceof Error ? error.message : String(error);
  updateMeasurement(actionId, (measurement) => ({ ...measurement, failedReason }));
}

export function snapshotClientActionLatency(): ClientActionLatencyMeasurement[] {
  return measurements.map((measurement) => ({
    ...measurement,
    targetHex: measurement.targetHex ? { ...measurement.targetHex } : undefined,
    phases: { ...measurement.phases },
  }));
}

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
};

export function summarizeClientActionLatency(operation?: string): ClientActionLatencySummary {
  const samplesMs = measurements.flatMap((measurement) => {
    if (operation && measurement.operation !== operation) return [];
    const clicked = measurement.phases.click;
    const rendered = measurement.phases.rendered;
    return clicked === undefined || rendered === undefined || rendered < clicked ? [] : [rendered - clicked];
  });

  return {
    completed: samplesMs.length,
    operation,
    p50ClickToRenderedMs: percentile(samplesMs, 0.5),
    p95ClickToRenderedMs: percentile(samplesMs, 0.95),
    samplesMs,
  };
}

export function clearClientActionLatency(): void {
  measurements = [];
  publish();
}
