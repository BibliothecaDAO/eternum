import type { ArmyMovementLatencyPhase, ArmyMovementLatencyTraceEntry } from "./army-movement-latency-trace";
import { snapshotArmyMovementLatencyTrace } from "./army-movement-latency-trace";

export interface ArmyMovementLatencyPhasePair {
  from: ArmyMovementLatencyPhase;
  to: ArmyMovementLatencyPhase;
}

export interface ArmyMovementLatencyPhasePairSummary {
  pair: ArmyMovementLatencyPhasePair;
  count: number;
  p50Ms: number;
  p75Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  recentDeltasMs: number[];
}

export interface ArmyMovementLatencySummary {
  generatedAtMs: number;
  sampleCount: number;
  phasePairs: ArmyMovementLatencyPhasePairSummary[];
}

interface ArmyMovementLatencySummaryTarget {
  __armyMovementLatencySummary?: ArmyMovementLatencySummary;
}

const RECENT_DELTA_WINDOW = 10;

export const ARMY_MOVEMENT_LATENCY_PHASE_PAIRS: readonly ArmyMovementLatencyPhasePair[] = [
  { from: "move_requested", to: "tx_response_received" },
  { from: "tx_response_received", to: "tx_submitted" },
  { from: "tx_submitted", to: "tx_confirmed" },
  { from: "move_requested", to: "tx_confirmed" },
  { from: "tx_submitted", to: "optimistic_animation_started" },
  { from: "tx_confirmed", to: "tileopt_stream_received" },
  { from: "tileopt_stream_received", to: "tileopt_component_received" },
  { from: "tileopt_stream_received", to: "movement_started" },
  { from: "optimistic_animation_started", to: "optimistic_animation_reconciled" },
  { from: "move_requested", to: "optimistic_animation_started" },
  { from: "move_requested", to: "movement_started" },
  { from: "movement_started", to: "movement_completed" },
];

export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;

  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercentile = Math.min(1, Math.max(0, percentile));
  const rank = Math.max(0, Math.ceil(clampedPercentile * sorted.length) - 1);
  return sorted[rank] ?? 0;
}

function collectPairDeltas(entries: ArmyMovementLatencyTraceEntry[], pair: ArmyMovementLatencyPhasePair): number[] {
  const pendingFromByEntity = new Map<number, number>();
  const deltas: number[] = [];

  for (const entry of entries) {
    if (entry.entityId === undefined) continue;

    if (entry.phase === pair.from) {
      pendingFromByEntity.set(entry.entityId, entry.wallTimeMs);
      continue;
    }

    if (entry.phase === pair.to) {
      const fromWallTime = pendingFromByEntity.get(entry.entityId);
      if (fromWallTime === undefined) continue;

      const delta = entry.wallTimeMs - fromWallTime;
      if (Number.isFinite(delta) && delta >= 0) {
        deltas.push(delta);
      }
      pendingFromByEntity.delete(entry.entityId);
    }
  }

  return deltas;
}

function summarizePair(
  entries: ArmyMovementLatencyTraceEntry[],
  pair: ArmyMovementLatencyPhasePair,
): ArmyMovementLatencyPhasePairSummary {
  const deltas = collectPairDeltas(entries, pair);

  if (deltas.length === 0) {
    return {
      pair,
      count: 0,
      p50Ms: 0,
      p75Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      meanMs: 0,
      minMs: 0,
      maxMs: 0,
      recentDeltasMs: [],
    };
  }

  const sum = deltas.reduce((acc, value) => acc + value, 0);
  return {
    pair,
    count: deltas.length,
    p50Ms: computePercentile(deltas, 0.5),
    p75Ms: computePercentile(deltas, 0.75),
    p95Ms: computePercentile(deltas, 0.95),
    p99Ms: computePercentile(deltas, 0.99),
    meanMs: sum / deltas.length,
    minMs: Math.min(...deltas),
    maxMs: Math.max(...deltas),
    recentDeltasMs: deltas.slice(-RECENT_DELTA_WINDOW),
  };
}

function getSummaryTarget(): ArmyMovementLatencySummaryTarget | null {
  if (typeof globalThis === "undefined") return null;
  return globalThis as ArmyMovementLatencySummaryTarget;
}

export function summarizeArmyMovementLatency(): ArmyMovementLatencySummary {
  const entries = snapshotArmyMovementLatencyTrace();
  const entityIds = new Set<number>();
  for (const entry of entries) {
    if (entry.entityId !== undefined) entityIds.add(entry.entityId);
  }

  const summary: ArmyMovementLatencySummary = {
    generatedAtMs: Date.now(),
    sampleCount: entityIds.size,
    phasePairs: ARMY_MOVEMENT_LATENCY_PHASE_PAIRS.map((pair) => summarizePair(entries, pair)),
  };

  const target = getSummaryTarget();
  if (target) {
    target.__armyMovementLatencySummary = summary;
  }

  return summary;
}
