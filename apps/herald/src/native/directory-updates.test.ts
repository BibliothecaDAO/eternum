import { expect, it, vi } from "vitest";
import { createHeraldRequestHandler } from "../http";
import { WorldFold } from "../world-fold";
import { LiveWorld } from "../live-world";
import type { MadaraRpc } from "../madara-rpc";
import type { RpcBlockWithReceipts } from "../types";
import { presetLaunch, presetRegistration } from "./preset-fixtures";
import { manifest, receipt, rowEvent, schema, setup, shardManifest } from "./fixtures";

it("indexes only structure positions across moves, replacement, overlays and checkpoint restore", () => {
  const { native, fold, decoder } = setup();
  const occupy = (col: number, entity: number, category = 1, structure = true) =>
    rowEvent("TileOccupancy", ["1", "0", String(col), "9"], {
      entity_id: String(entity),
      category: String(category),
      is_structure: BigInt(structure ? "1" : "0") !== 0n,
    });
  const deleted = (col: number) => ({
    from_address: manifest.world.address,
    keys: [
      ...schema.games.events.find(({ name }) => name === "RowDeleted")!.prefix,
      "1",
      schema.models.find(({ name }) => name === "TileOccupancy")!.identity,
    ],
    data: ["4", "1", "0", String(col), "9"],
  });
  native.applyReceipt(
    fold,
    receipt([occupy(1, 7), occupy(2, 8, 15, false), occupy(3, 9, 35), occupy(4, 0, 39)]),
    10,
    0,
  );
  expect(fold.structurePosition("1", "7")).toMatchObject({ col: "0x1", row: "0x9" });
  for (const id of ["0", "8", "9"]) expect(fold.structurePosition("1", id)).toBeUndefined();
  const before = fold.directoryRevision();
  native.applyReceipt(fold, receipt([deleted(2), occupy(5, 8, 15, false)]), 11, 0);
  expect(fold.directoryRevision()).toBe(before);
  const overlay = fold.overlay();
  native.applyReceipt(overlay, receipt([deleted(1), occupy(6, 7)]), null, 0);
  expect(overlay.structurePosition("1", "7")).toMatchObject({ col: "0x6" });
  expect(fold.structurePosition("1", "7")).toMatchObject({ col: "0x1" });
  native.applyReceipt(fold, receipt([deleted(1), occupy(6, 7), occupy(4, 10, 39)]), 12, 0);
  expect(fold.structurePosition("1", "10")).toMatchObject({ col: "0x4" });
  // Placement can precede deletion in a replayed receipt: deleting the old tile must not erase the new reference.
  const later = fold.overlay();
  native.applyReceipt(later, receipt([occupy(7, 7)]), null, 0);
  const revision = later.directoryRevision();
  native.applyReceipt(later, receipt([deleted(6)]), null, 0);
  expect(later.directoryRevision()).toBe(revision);
  expect(later.structurePosition("1", "7")).toMatchObject({ col: "0x7" });
  native.applyReceipt(fold, receipt([occupy(7, 7), deleted(6)]), 13, 0);
  expect(fold.structurePosition("1", "7")).toMatchObject({ col: "0x7" });
  const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
  expect(restored.structurePosition("1", "7")).toEqual(later.structurePosition("1", "7"));
  native.applyReceipt(restored, receipt([deleted(7)]), 14, 0);
  expect(restored.structurePosition("1", "7")).toBeUndefined();
});

it("an army move does not notify directory clients; structure moves and empty-block clock transitions do", async () => {
  const { native, fold, decoder } = setup();
  const preset = presetRegistration(2);
  native.applyReceipt(fold, receipt([preset.event]), 10, 0, preset.calldata);
  native.applyReceipt(fold, receipt(presetLaunch(preset, 1, 100)), 10, 0);
  const structure = rowEvent("TileOccupancy", ["1", "0", "1", "1"], {
    entity_id: 7n,
    category: 1n,
    is_structure: true,
  });
  const army = rowEvent("TileOccupancy", ["1", "0", "5", "5"], { entity_id: 8n, category: 15n, is_structure: false });
  native.applyReceipt(fold, receipt([structure, army]), 10, 0);
  const blocks = new Map<number, RpcBlockWithReceipts>();
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    confirmedBlock: 10,
    confirmedFold: fold,
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => {} },
    rpc: {
      getBlockWithReceipts: async (block: number | "pre_confirmed") =>
        block === "pre_confirmed"
          ? { block_number: Math.max(10, ...blocks.keys()) + 1, timestamp: 50, transactions: [] }
          : blocks.get(block)!,
    } as unknown as MadaraRpc,
  });
  const handler = createHeraldRequestHandler({
    chain: "madara",
    manifest: shardManifest,
    schemas: {},
    worldAddress: manifest.world.address,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    decodedModelCount: decoder.registry.bySelector.size,
    fold: {
      modelRows: (model) => fold.modelRows(model),
      structurePosition: (game, entity) => fold.structurePosition(game, entity),
      directoryRevision: () => fold.directoryRevision(),
      snapshot: (game, block, models) => fold.snapshot(game, block, models),
    },
    undecodableEventCount: () => 0,
    metrics: { decoded_events: 0, event_messages: 0, pages: 0, retained_rows: 0, store_events: 0 },
    subscribeConfirmedChanges: (listener) => live.subscribeConfirmedChanges(listener),
  });
  const response = await handler(new Request("http://herald/games/updates"));
  const reader = response.body!.getReader();
  const messages: string[] = [];
  const drain = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      messages.push(new TextDecoder().decode(value));
    }
  })();
  await vi.waitFor(() => expect(messages).toHaveLength(1));
  const confirm = async (events: ReturnType<typeof rowEvent>[], timestamp: number) => {
    const block = live.confirmedBlock + 1;
    blocks.set(block, {
      block_number: block,
      timestamp,
      transactions: [{ receipt: receipt(events, `0x${block.toString(16)}`), transaction: { type: "INVOKE" } }],
    });
    await live.acceptSubscribedHead({ block_number: block, timestamp });
  };
  const move = (event: ReturnType<typeof rowEvent>, col: string) => {
    const deleted = {
      ...event,
      keys: [
        ...schema.games.events.find(({ name }) => name === "RowDeleted")!.prefix,
        "1",
        schema.models.find(({ name }) => name === "TileOccupancy")!.identity,
      ],
      data: event.data.slice(0, 5),
    };
    const placed = structuredClone(event);
    placed.data[3] = col;
    return [deleted, placed];
  };
  await confirm(move(army, "6"), 50);
  expect(messages).toHaveLength(1);
  await confirm(move(structure, "2"), 51);
  await vi.waitFor(() => expect(messages).toHaveLength(2));
  await confirm([], 100);
  await vi.waitFor(() => expect(messages).toHaveLength(3));
  await confirm([], 101);
  expect(messages).toHaveLength(3);
  await reader.cancel();
  await drain;
});
