import type { ID } from "@bibliothecadao/types";

export type ArmyMovementLatencyPhase =
  | "move_requested"
  | "tx_submitted"
  | "tx_response_received"
  | "tx_confirmed"
  | "tileopt_stream_received"
  | "tileopt_component_received"
  | "tileopt_component_ready"
  | "worldmap_tile_update_received"
  | "army_manager_tile_update_applied"
  | "movement_started"
  | "movement_completed";

export type ArmyMovementLatencySource = "worldmap" | "torii_sync" | "world_update_listener";

export interface ArmyMovementLatencyTraceEntry {
  sequence: number;
  phase: ArmyMovementLatencyPhase;
  source: ArmyMovementLatencySource;
  entityId?: ID;
  txHash?: string;
  tileEntityKey?: string;
  timestampMs: number;
  wallTimeMs: number;
  details?: Record<string, unknown>;
}

interface ArmyMovementLatencyTraceTarget {
  __armyMovementLatencyTraceEntries?: ArmyMovementLatencyTraceEntry[];
}

const MAX_TRACE_ENTRIES = 400;

let sequence = 0;
let traceEntries: ArmyMovementLatencyTraceEntry[] = [];

function getTraceTarget(): ArmyMovementLatencyTraceTarget | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return globalThis as ArmyMovementLatencyTraceTarget;
}

function publishTraceEntries(): void {
  const target = getTraceTarget();
  if (!target) {
    return;
  }

  target.__armyMovementLatencyTraceEntries = traceEntries;
}

export function recordArmyMovementLatencyPhase(input: {
  phase: ArmyMovementLatencyPhase;
  source: ArmyMovementLatencySource;
  entityId?: ID;
  txHash?: string;
  tileEntityKey?: string;
  timestampMs?: number;
  wallTimeMs?: number;
  details?: Record<string, unknown>;
}): void {
  sequence += 1;

  traceEntries = [
    ...traceEntries,
    {
      sequence,
      phase: input.phase,
      source: input.source,
      entityId: input.entityId,
      txHash: input.txHash,
      tileEntityKey: input.tileEntityKey,
      timestampMs: input.timestampMs ?? Date.now(),
      wallTimeMs: input.wallTimeMs ?? performance.now(),
      details: input.details,
    },
  ].slice(-MAX_TRACE_ENTRIES);

  publishTraceEntries();
}

export function snapshotArmyMovementLatencyTrace(): ArmyMovementLatencyTraceEntry[] {
  return [...traceEntries];
}

export function clearArmyMovementLatencyTrace(): void {
  traceEntries = [];
  publishTraceEntries();
}
