import { appendConsoleFields } from "@/utils/console-message";

export type WorldmapChunkTraceEvent =
  | "scene_created"
  | "chunk_activated"
  | "chunk_deactivated"
  | "chunk_transition_noop"
  | "mouse_chunk_enter"
  | "mouse_chunk_leave"
  | "projection_tiles_synced"
  | "chunk_presentation_timeout"
  | "chunk_transition_hard_timeout"
  | "connection_failure_recovery"
  | "terrain_shell_started"
  | "terrain_shell_committed"
  | "terrain_shell_replaced"
  | "terrain_composite_rebuilt"
  | "terrain_shell_stale_dropped"
  | "visual_window_resolved"
  | "visual_page_queued"
  | "visual_page_built"
  | "visual_page_committed"
  | "visual_page_replaced"
  | "visual_page_evicted"
  | "visual_page_stale_dropped"
  | "visual_page_live_tile_invalidated"
  | "visual_page_budget_exhausted"
  | "chunk_recovery_scheduled"
  | "chunk_recovery_executed"
  | "reconnect_refresh_requested"
  | "reconnect_refresh_skipped"
  | "reconnect_refresh_queued"
  | "reconnect_refresh_drained"
  | "army_authoritative_sweep"
  | "army_authoritative_sweep_slow"
  | "army_recs_sweep_heal"
  | "army_recs_sweep_slow_pass";

export interface WorldmapChunkTraceEntry {
  id: number;
  event: WorldmapChunkTraceEvent;
  atMs: number;
  atIso: string;
  details: Record<string, unknown>;
}

interface WorldmapChunkTraceBuffer {
  entries: WorldmapChunkTraceEntry[];
  nextId: number;
  maxEntries: number;
}

const DEFAULT_WORLD_CHUNK_TRACE_LIMIT = 256;

const readConsoleField = (value: unknown): string | number | boolean | bigint | null | undefined => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  return undefined;
};

export function formatWorldmapChunkWarning(
  event: WorldmapChunkTraceEvent,
  details: Readonly<Record<string, unknown>>,
): string {
  const fields = Object.fromEntries(Object.entries(details).map(([name, value]) => [name, readConsoleField(value)]));
  return appendConsoleFields(`[WorldmapChunk] ${event}`, fields);
}

export function createWorldmapChunkTraceBuffer(
  maxEntries: number = DEFAULT_WORLD_CHUNK_TRACE_LIMIT,
): WorldmapChunkTraceBuffer {
  return {
    entries: [],
    nextId: 1,
    maxEntries: Math.max(1, Math.floor(maxEntries)),
  };
}

export function appendWorldmapChunkTrace(
  buffer: WorldmapChunkTraceBuffer,
  event: WorldmapChunkTraceEvent,
  details: Record<string, unknown>,
): WorldmapChunkTraceEntry {
  const entry: WorldmapChunkTraceEntry = {
    id: buffer.nextId,
    event,
    atMs: Date.now(),
    atIso: new Date().toISOString(),
    details,
  };

  buffer.nextId += 1;
  buffer.entries.push(entry);

  if (buffer.entries.length > buffer.maxEntries) {
    buffer.entries.splice(0, buffer.entries.length - buffer.maxEntries);
  }

  return entry;
}

export function snapshotWorldmapChunkTrace(buffer: WorldmapChunkTraceBuffer): WorldmapChunkTraceEntry[] {
  return buffer.entries.map((entry) => ({
    ...entry,
    details: { ...entry.details },
  }));
}
