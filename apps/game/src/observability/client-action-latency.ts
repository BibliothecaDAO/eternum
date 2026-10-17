import type { SendStage } from "@bibliothecadao/eternum/game-client";

export type ClientActionLatencyPhase =
  | "click"
  /** The local pending state (ghost, highlighted path, selected destination) is on screen — same frame as the click. */
  | "ghost_rendered"
  | "calls_built"
  | "submit_guard_released"
  | "sign_send_started"
  | "submitted"
  | "pre_confirmed"
  | "diff_received"
  | "store_applied"
  | "rendered";

export interface ClientActionLatencyMeasurement {
  actionId: string;
  operation: string;
  surface: string;
  entityId?: number;
  targetHex?: { col: number; row: number };
  transactionHash?: string;
  phases: Partial<Record<ClientActionLatencyPhase, number>>;
  failedReason?: string;
  /**
   * The send this action made, as the game client reported it: each stage it reached, once. A send no action claims
   * is its own record (operation "send", surface "unattributed"): automation, a background or an uninstrumented order.
   */
  send?: { key: string; stages: Array<{ stage: SendStage; at: number; detail?: string }> };
}

export interface ClientActionLatencySummary {
  completed: number;
  operation?: string;
  p50ClickToRenderedMs: number;
  p95ClickToRenderedMs: number;
  p50PreConfirmedToRenderedMs: number;
  p95PreConfirmedToRenderedMs: number;
  samplesMs: number[];
}

interface ClientActionLatencyTarget {
  __clientActionLatencyMeasurements?: ClientActionLatencyMeasurement[];
  __clientActionLatencySummary?: ClientActionLatencySummary;
  __admissionToVisibleMs?: number[];
}

const MAX_MEASUREMENTS = 400;
let nextActionSequence = 0;
let measurements: ClientActionLatencyMeasurement[] = [];
let admissionToVisibleMs: number[] = [];
const listeners = new Set<() => void>();

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
  target.__admissionToVisibleMs = [...admissionToVisibleMs];
  for (const listener of listeners) listener();
};

/** The records as they stand, for a view that subscribes: the same array until the next change. */
export function readClientActionRecords(): readonly ClientActionLatencyMeasurement[] {
  return measurements;
}

export function subscribeClientActionRecords(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const UNATTRIBUTED = "unattributed";

/**
 * A send's stage, under a key unique for this page (its client and its number there). Only its command admits a
 * record, so a stage of a send already evicted is dropped; each stage is kept once. Once the send names its hash, it
 * joins the action that sent that hash.
 */
export function recordClientActionSendStage(
  sendKey: string,
  stage: SendStage,
  detail?: string,
  transactionHash?: string,
): void {
  const reached = { stage, at: now(), ...(detail !== undefined ? { detail } : {}) };
  const record = measurements.find((measurement) => measurement.send?.key === sendKey);
  if (!record) {
    if (stage !== "command") return;
    measurements = [
      ...measurements,
      {
        actionId: `send:${sendKey}`,
        operation: "send",
        surface: UNATTRIBUTED,
        phases: {},
        send: { key: sendKey, stages: [reached] },
      },
    ].slice(-MAX_MEASUREMENTS);
    publish();
    return;
  }
  if (record.send!.stages.some((each) => each.stage === stage)) return;
  measurements = measurements.map((measurement) =>
    measurement === record
      ? {
          ...measurement,
          ...(transactionHash && !measurement.transactionHash ? { transactionHash } : {}),
          send: { key: sendKey, stages: [...measurement.send!.stages, reached] },
        }
      : measurement,
  );
  if (transactionHash) joinSendToAction(transactionHash);
  publish();
}

/** An unattributed send and the action that sent the same transaction become one record: the action, with its send. */
function joinSendToAction(transactionHash: string): void {
  const hash = normalizeTransactionHash(transactionHash);
  const sameHash = (measurement: ClientActionLatencyMeasurement) =>
    measurement.transactionHash !== undefined && normalizeTransactionHash(measurement.transactionHash) === hash;
  const send = measurements.find((measurement) => measurement.surface === UNATTRIBUTED && sameHash(measurement));
  const action = measurements.find(
    (measurement) => measurement.surface !== UNATTRIBUTED && measurement.send === undefined && sameHash(measurement),
  );
  if (!send || !action) return;
  measurements = measurements
    .filter((measurement) => measurement !== send)
    .map((measurement) => (measurement === action ? { ...measurement, send: send.send } : measurement));
}

/**
 * Every action's admission to visible, as the provider measures it: from sending the invoke to the stream reporting
 * its outcome with its facts applied. The harness reports the same figure for its bots.
 */
export function recordAdmissionToVisible(milliseconds: number): void {
  admissionToVisibleMs = [...admissionToVisibleMs, milliseconds].slice(-MAX_MEASUREMENTS);
  publish();
}

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
  measurements = measurements.map((measurement) =>
    measurement.actionId === actionId
      ? { ...measurement, transactionHash, phases: { ...measurement.phases, submitted: now() } }
      : measurement,
  );
  joinSendToAction(transactionHash);
  publish();
}

export function recordClientActionPhase(actionId: string, phase: ClientActionLatencyPhase): void {
  updateMeasurement(actionId, (measurement) => ({
    ...measurement,
    phases: measurement.phases[phase] !== undefined ? measurement.phases : { ...measurement.phases, [phase]: now() },
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

export function recordClientActionDiffReceived(transactionHash: string): void {
  recordTransactionPhase(transactionHash, "diff_received");
}

export function recordClientActionStoreApplied(transactionHash: string): void {
  recordTransactionPhase(transactionHash, "store_applied");
}

function recordTransactionPhase(transactionHash: string, phase: ClientActionLatencyPhase): void {
  const actionId = findActionIdByTransactionHash(transactionHash);
  if (actionId) recordClientActionPhase(actionId, phase);
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
    ...(measurement.send ? { send: { key: measurement.send.key, stages: [...measurement.send.stages] } } : {}),
  }));
}

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
};

export function summarizeClientActionLatency(operation?: string): ClientActionLatencySummary {
  const matchingMeasurements = measurements.filter((measurement) => !operation || measurement.operation === operation);
  const samplesMs = matchingMeasurements.flatMap((measurement) => {
    const clicked = measurement.phases.click;
    const rendered = measurement.phases.rendered;
    return clicked === undefined || rendered === undefined || rendered < clicked ? [] : [rendered - clicked];
  });
  const preConfirmedToRenderedMs = matchingMeasurements.flatMap((measurement) => {
    const preConfirmed = measurement.phases.pre_confirmed;
    const rendered = measurement.phases.rendered;
    return preConfirmed === undefined || rendered === undefined || rendered < preConfirmed
      ? []
      : [rendered - preConfirmed];
  });

  return {
    completed: samplesMs.length,
    operation,
    p50ClickToRenderedMs: percentile(samplesMs, 0.5),
    p95ClickToRenderedMs: percentile(samplesMs, 0.95),
    p50PreConfirmedToRenderedMs: percentile(preConfirmedToRenderedMs, 0.5),
    p95PreConfirmedToRenderedMs: percentile(preConfirmedToRenderedMs, 0.95),
    samplesMs,
  };
}

export function clearClientActionLatency(): void {
  measurements = [];
  admissionToVisibleMs = [];
  publish();
}
