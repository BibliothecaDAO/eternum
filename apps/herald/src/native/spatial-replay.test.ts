import { readFileSync } from "node:fs";
import { NativeFactStore, type NativeModelName } from "@bibliothecadao/eternum/game-client";
import type { GameSyncFact } from "@bibliothecadao/eternum/game-sync";
import { shortString } from "starknet";
import { describe, expect, it } from "vitest";
import { WorldFold } from "../world-fold";
import { toJsonValue } from "../model-registry";
import type { FoldChange, RpcReceipt } from "../types";
import { manifest, receipt, setup } from "./fixtures";

const models: NativeModelName[] = ["Structure", "ExplorerTroops", "TileOccupancy", "Building", "StructureBuildings"];

/** Raw successful command events and the contract's own views after each command. */
function frames(name: string) {
  const path = new URL(
    `../../../../contracts/l3/world-native/tests/fixtures/spatial-replay/${name}.txt`,
    import.meta.url,
  );
  const values = readFileSync(path, "utf8").trim().split(/\s+/);
  let index = 0;
  const next = (): string => {
    const value = values[index++];
    if (value === undefined) throw new Error("Truncated spatial replay fixture");
    return value;
  };
  const span = () => Array.from({ length: Number(next()) }, next);
  const result = Array.from({ length: Number(next()) }, (_, frame) => ({
    receipt: receipt(
      Array.from({ length: Number(next()) }, () => ({
        from_address: manifest.world.address,
        keys: span(),
        data: span(),
      })),
      `0x${(frame + 1).toString(16)}`,
    ),
    rows: Array.from({ length: Number(next()) }, () => ({
      model: shortString.decodeShortString(next()),
      keys: span(),
      values: span(),
    })),
  }));
  expect(index).toBe(values.length);
  return result;
}

function ingest(store: NativeFactStore, changes: { change?: FoldChange }[]) {
  const facts: GameSyncFact[] = [];
  for (const { change } of changes) {
    if (change?.set) facts.push(change.set);
    if (change?.del) facts.push({ ...change.del, value: null });
  }
  store.applyFacts(facts);
}

function visibleFacts(store: NativeFactStore) {
  return models.map((model) => ({
    model,
    rows: [...store.rows(model)].map((row) => JSON.stringify(toJsonValue(row))).sort(),
  }));
}

describe("recorded spatial and board commands", () => {
  it.each(["armies", "buildings"])("replays %s into the same contract views and client facts", async (name) => {
    const { decoder, native, fold } = setup();
    const store = new NativeFactStore();
    const recorded = frames(name);
    for (const [index, frame] of recorded.entries()) {
      const overlay = fold.overlay();
      native.applyReceipt(overlay, { ...frame.receipt, finality_status: "PRE_CONFIRMED" }, null, 0);
      ingest(store, native.applyReceipt(fold, frame.receipt, index + 10, 0).changes);
      const expected = new WorldFold(decoder.registry);
      for (const row of frame.rows) expected.apply(decoder.decodeRowSet(row.model, row.keys, row.values));
      const expectedSnapshot = expected.snapshot(3, index + 10, models);
      expect(fold.snapshot(3, index + 10, models)).toEqual(expectedSnapshot);
      expect(overlay.snapshot(3, index + 10, models)).toEqual(expectedSnapshot);
      const expectedStore = new NativeFactStore();
      expectedStore.applyFacts(
        expectedSnapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, ...row }))),
      );
      expect(visibleFacts(store)).toEqual(visibleFacts(expectedStore));
      for (const army of store.inGame("ExplorerTroops", 3)) {
        expect([...store.armiesAtHome(3, army.owner)]).toContainEqual(army);
        expect(store.entityOccupancy(3, army.explorer_id)).toBeDefined();
      }
    }
    const replay = new WorldFold(decoder.registry);
    await native.replay({
      fold: replay,
      fromBlock: 10,
      toBlock: recorded.length + 9,
      rpc: {
        getBlockWithReceipts: async (block) => ({
          block_number: Number(block),
          timestamp: 0,
          transactions: [
            { receipt: recorded[Number(block) - 10].receipt as RpcReceipt, transaction: { type: "INVOKE" } },
          ],
        }),
      },
    });
    expect(replay.snapshot(3, recorded.length + 9, models)).toEqual(fold.snapshot(3, recorded.length + 9, models));
  });
});
