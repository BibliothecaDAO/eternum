import { describe, expect, it, vi } from "vitest";

import { ingestWorld } from "./world-events";

describe("world ingest orchestration", () => {
  it("writes a snapshot and publishes derived wake events", async () => {
    const publishWakeups = vi.fn(async () => {});

    const result = await ingestWorld(
      {
        fetchWorldSnapshot: async () => ({ tiles: 42 }),
        writeSnapshot: async () => ({
          worldId: "world-1",
          version: 7,
          snapshotKey: "snapshots/world-1/7.json",
        }),
        deriveEvents: async () => [
          {
            id: "event-1",
            worldId: "world-1",
            type: "threat_detected",
            wakeReason: "world_event",
            payload: { target: "agent-1" },
            dedupeKey: "world-1:threat:agent-1",
          },
        ],
        publishWakeups,
      },
      {
        worldId: "world-1",
        reason: "scheduled_poll",
        requestedAt: new Date().toISOString(),
      },
    );

    expect(result.snapshot.version).toBe(7);
    expect(result.eventsPublished).toBe(1);
    expect(publishWakeups).toHaveBeenCalledOnce();
  });
});
