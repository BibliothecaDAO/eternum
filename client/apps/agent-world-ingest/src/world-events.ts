import type { AgentWakeReason, WorldIngestJob } from "@bibliothecadao/types";

export interface DerivedWorldEvent {
  id: string;
  worldId: string;
  type: string;
  wakeReason: AgentWakeReason;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

export interface WorldSnapshotWriteResult {
  worldId: string;
  version: number;
  snapshotKey: string;
}

export interface WorldIngestServices {
  fetchWorldSnapshot(worldId: string): Promise<Record<string, unknown>>;
  writeSnapshot(input: {
    worldId: string;
    snapshot: Record<string, unknown>;
    summary: Record<string, unknown>;
  }): Promise<WorldSnapshotWriteResult>;
  deriveEvents(input: {
    worldId: string;
    snapshot: Record<string, unknown>;
    version: number;
  }): Promise<DerivedWorldEvent[]>;
  publishWakeups(events: DerivedWorldEvent[]): Promise<void>;
}

export async function ingestWorld(services: WorldIngestServices, job: WorldIngestJob) {
  const snapshot = await services.fetchWorldSnapshot(job.worldId);
  const summary = {
    reason: job.reason,
    requestedAt: job.requestedAt,
  };
  const writeResult = await services.writeSnapshot({
    worldId: job.worldId,
    snapshot,
    summary,
  });
  const events = await services.deriveEvents({
    worldId: job.worldId,
    snapshot,
    version: writeResult.version,
  });
  await services.publishWakeups(events);
  return {
    snapshot: writeResult,
    eventsPublished: events.length,
  };
}
