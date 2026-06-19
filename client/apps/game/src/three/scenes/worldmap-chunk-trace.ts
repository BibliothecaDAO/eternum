export type WorldmapChunkTraceEvent =
  | "scene_created"
  | "chunk_activated"
  | "chunk_deactivated"
  | "chunk_transition_noop"
  | "mouse_chunk_enter"
  | "mouse_chunk_leave"
  | "torii_bounds_switch_requested"
  | "torii_bounds_switch_applied"
  | "torii_bounds_switch_skipped_same_signature"
  | "torii_bounds_switch_failed"
  | "torii_bounds_switch_timeout"
  | "global_spatial_sync_bounds_ready"
  | "global_spatial_recs_hydrated"
  | "spatial_tileopt_stream_received"
  | "spatial_tileopt_recs_applied"
  | "spatial_tileopt_ready_timeout"
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
  | "visual_page_budget_exhausted"
  | "chunk_recovery_scheduled"
  | "chunk_recovery_executed"
  | "reconnect_refresh_requested"
  | "reconnect_refresh_skipped"
  | "reconnect_refresh_queued"
  | "reconnect_refresh_drained"
  | "torii_resubscribe_requested"
  | "torii_resubscribe_completed"
  | "torii_resubscribe_failed"
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
