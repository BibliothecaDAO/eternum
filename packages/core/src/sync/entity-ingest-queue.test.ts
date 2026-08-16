import { describe, expect, it, vi } from "vitest";
import { EntityIngestQueue } from "./entity-ingest-queue";
import type { GameSyncEntityStoreOperation, GameSyncStore } from "./game-sync-types";
import { createManualGameSyncScheduler } from "./scheduler";

describe("EntityIngestQueue", () => {
  it("coalesces upserts per entity and model while preserving deletion and event barriers", async () => {
    const scheduler = createManualGameSyncScheduler();
    const calls: Array<{ type: "entities"; operations: readonly GameSyncEntityStoreOperation[] } | { type: "event" }> =
      [];
    const store: GameSyncStore = {
      applyEntityOperations: vi.fn((operations) => calls.push({ type: "entities", operations: [...operations] })),
      applyEvent: vi.fn(() => calls.push({ type: "event" })),
      listModelEntityIds: () => [],
    };
    const queue = new EntityIngestQueue({ scheduler, store, now: () => 0 });

    queue.enqueueEntity({ hashed_keys: "one", models: { Position: { x: 1 } } });
    queue.enqueueEntity({ hashed_keys: "one", models: { Position: { x: 2 }, Stats: { hp: 5 } } });
    queue.enqueueEntity({ hashed_keys: "one", models: { Position: {} } });
    queue.enqueueEntity({ hashed_keys: "one", models: { Position: { x: 3 } } });
    queue.enqueueEvent({ hashed_keys: "event", models: { BattleEvent: { winner: 1 } } });
    queue.enqueueEntity({ hashed_keys: "one", models: {} });
    const drained = queue.drain();
    scheduler.flushNext();
    await drained;

    expect(calls).toEqual([
      {
        type: "entities",
        operations: [
          {
            type: "upsert",
            entities: [{ hashed_keys: "one", models: { Position: { x: 2 }, Stats: { hp: 5 } } }],
          },
          { type: "remove-components", entityId: "one", models: ["Position"] },
          { type: "upsert", entities: [{ hashed_keys: "one", models: { Position: { x: 3 } } }] },
        ],
      },
      { type: "event" },
      { type: "entities", operations: [{ type: "delete-entity", entityId: "one" }] },
    ]);
  });

  it("unions member fields when coalescing same-frame partial updates for one entity and model", async () => {
    const scheduler = createManualGameSyncScheduler();
    const calls: GameSyncEntityStoreOperation[][] = [];
    const store: GameSyncStore = {
      applyEntityOperations: vi.fn((operations) => calls.push([...operations])),
      applyEvent: vi.fn(),
      listModelEntityIds: () => [],
    };
    const queue = new EntityIngestQueue({ scheduler, store, now: () => 0 });

    // A provision-style burst: torii delivers one member per update.
    queue.enqueueEntity({ hashed_keys: "realm", models: { Resource: { LABOR_BALANCE: 10n } } });
    queue.enqueueEntity({ hashed_keys: "realm", models: { Resource: { WHEAT_BALANCE: 20n } } });
    queue.enqueueEntity({ hashed_keys: "realm", models: { Resource: { WOOD_BALANCE: 30n, WHEAT_BALANCE: 25n } } });
    const drained = queue.drain();
    scheduler.flushNext();
    await drained;

    expect(calls).toEqual([
      [
        {
          type: "upsert",
          entities: [
            {
              hashed_keys: "realm",
              models: { Resource: { LABOR_BALANCE: 10n, WHEAT_BALANCE: 25n, WOOD_BALANCE: 30n } },
            },
          ],
        },
      ],
    ]);
  });

  it("rejects recovery drains when a RECS batch fails", async () => {
    const scheduler = createManualGameSyncScheduler();
    const store: GameSyncStore = {
      applyEntityOperations: vi.fn(() => {
        throw new Error("RECS write failed");
      }),
      applyEvent: vi.fn(),
      listModelEntityIds: () => [],
    };
    const queue = new EntityIngestQueue({ scheduler, store, now: () => 0 });

    queue.enqueueEntity({ hashed_keys: "one", models: { Position: { x: 1 } } });
    const drained = queue.drain();
    scheduler.flushNext();

    await expect(drained).rejects.toThrow("RECS write failed");
    await expect(queue.drain()).rejects.toThrow("RECS write failed");
  });
});
