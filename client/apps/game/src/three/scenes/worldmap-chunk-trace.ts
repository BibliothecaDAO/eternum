export type WorldmapChunkTraceEvent =
  | "scene_created"
  | "chunk_activated"
  | "chunk_deactivated"
  | "chunk_transition_noop"
  | "mouse_chunk_enter"
  | "mouse_chunk_leave"
  | "torii_bounds_switch_requested"
  | "torii_bounds_switch_applied"
  | "torii_bounds_switch_failed"
  | "torii_bounds_switch_timeout"
  | "chunk_presentation_timeout"
  | "chunk_recovery_scheduled"
  | "chunk_recovery_executed"
  | "torii_resubscribe_requested"
  | "torii_resubscribe_completed"
  | "torii_resubscribe_failed";

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
