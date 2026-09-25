import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortString } from "starknet";
import { nativeSyncScopes } from "../../../../contracts/l3/world-native/schema/client.gen";
import { WorldFold } from "../world-fold";
import type { RpcEvent } from "../types";
import { manifest, receipt, schema, setup, raw } from "./fixtures";
const retiredMetadataModels = [
  "RealmCatalogue",
  "Authentication",
  "GameSequence",
  "EntitySequence",
  "LedgerOperator",
] as const;

// This exact wire is asserted against emitted events and storage views by the Cairo season-lifecycle test.
const pointWire = readFileSync(
  new URL("../../../../contracts/l3/world-native/tests/fixtures/gameplay-facts/points-awards.txt", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\s+/);
const pointLayout = schema.games.events.find(({ name }) => name === "PointsAwarded")!;
const awards: RpcEvent[] = Array.from({ length: pointWire.length / 7 }, (_, index) => {
  const values = pointWire.slice(index * 7, index * 7 + 7);
  return {
    from_address: manifest.world.address,
    keys: [...pointLayout.prefix, ...values.slice(0, 3)],
    data: values.slice(3),
  };
});
const balances = (fold: WorldFold) => ({
  players: fold
    .modelRows("PlayerPoints")
    .map(({ value }) => [BigInt(String(value.address)), BigInt(String(value.points))])
    .sort(([left], [right]) => (left < right ? -1 : 1)),
  total: fold.modelRows("PointsTotal").map(({ value }) => BigInt(String(value.total))),
});

describe("gameplay-only native facts", () => {
  it("projects Cairo-checked absolute points identically in the overlay, confirmation and checkpoint replay", async () => {
    const { native, decoder, fold } = setup();
    const overlay = fold.overlay();
    const first = receipt(awards.slice(0, 2), "0x100");
    native.applyReceipt(overlay, first, null, 0);
    expect(balances(fold)).toEqual({ players: [], total: [] });
    const confirmed = native.applyReceipt(fold, first, 10, 0);
    expect(balances(fold)).toEqual(balances(overlay));
    expect(
      confirmed.changes.filter(({ change }) => change && !change.event).map(({ change }) => change!.set!.model),
    ).toEqual(["PlayerPoints", "PointsTotal", "PlayerPoints", "PointsTotal"]);
    // Re-applying the same absolute facts must not add the award a second time.
    native.applyReceipt(fold, first, 10, 0);
    const resumed = WorldFold.restore(decoder.registry, fold.checkpoint());
    const last = receipt(awards.slice(2), "0x101");
    native.applyReceipt(resumed, last, 11, 0);
    native.applyReceipt(overlay, last, null, 0);
    const replayed = new WorldFold(decoder.registry);
    await native.replay({
      fold: replayed,
      fromBlock: 10,
      toBlock: 11,
      rpc: {
        getBlockWithReceipts: async (block) => ({
          block_number: Number(block),
          timestamp: 100,
          transactions: [{ receipt: Number(block) === 10 ? first : last, transaction: { type: "INVOKE" } }],
        }),
      },
    });
    const expected = {
      players: [
        [273n, 9007199254741004n],
        [546n, 7n],
      ],
      total: [9007199254741011n],
    };
    expect(balances(resumed)).toEqual(expected);
    expect(balances(replayed)).toEqual(expected);
    expect(balances(overlay)).toEqual(expected);
    expect(replayed.snapshot(3, 11)).toEqual(resumed.snapshot(3, 11));
  });

  it("rejects a malformed later award without publishing any partial points", () => {
    const { native, fold } = setup();
    const malformed = { ...awards[1], data: awards[1].data.slice(0, -1) };
    expect(() => native.applyReceipt(fold, receipt([awards[0], malformed]), 10, 0)).toThrow();
    expect(balances(fold)).toEqual({ players: [], total: [] });
  });

  it.each(retiredMetadataModels)("has no decoder or sync scope for retired %s rows", (name) => {
    const { decoder } = setup();
    const row = schema.games.events.find(({ name }) => name === "RowSet")!;
    const event = {
      from_address: manifest.world.address,
      keys: [...row.prefix, "1", shortString.encodeShortString(name)],
      data: ["1", "1", "1", "1"],
    };
    expect(schema.models.some((model) => model.name === name)).toBe(false);
    expect(name in nativeSyncScopes).toBe(false);
    expect(() => decoder.decode(raw(event))).toThrow("Unknown native model");
  });
});
