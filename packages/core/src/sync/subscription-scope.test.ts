import { describe, expect, it } from "vitest";
import { rowInGameSyncScope } from "./model-manifest";
import { deriveGameSyncScope, scopeInputKeys, type ScopeRowReader } from "./subscription-scope";

const expedition = { epochSeconds: 100, spacing: 1024, startMainAt: 300 };
const rows = [
  { model: "PlayerEntry", value: { owner: "11", player: "3003" } },
  { model: "Structure", value: { entity_id: "1", owner: "10", base: { category: 1 }, metadata: { realm_id: 1 } } },
  { model: "Structure", value: { entity_id: "2", owner: "11", base: { category: 1 }, metadata: { realm_id: 2 } } },
  { model: "ExplorerTroops", value: { explorer_id: "101", owner: "1", troops: { count: "1000000000" } } },
  { model: "ExplorerTroops", value: { explorer_id: "102", owner: "2", troops: { count: "1000000000" } } },
  { model: "TileOccupancy", value: { entity_id: "101", category: "26", alt: false, col: 512, row: 1600 } },
  { model: "TileOccupancy", value: { entity_id: "102", category: "26", alt: false, col: 1600, row: 2700 } },
];
const read: ScopeRowReader = (model, spacing, keys) =>
  rows.filter(
    (row) => row.model === model && scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
  );

const visit = () => deriveGameSyncScope("0xa", 350, expedition, read, "0xbbb");

describe("visited realm scope", () => {
  it("adds the resolved owner's buildings, knowledge and armies without their map regions or nonce", () => {
    const scope = visit();
    expect(scope.expedition?.owners).toEqual(new Set(["10", "11", "3003"]));
    expect(scope.expedition?.realms).toEqual(new Set(["1", "2"]));
    expect(scope.expedition?.regions).toEqual(new Set(["0:1"]));
    expect(scope.expedition?.entities).toEqual(new Set(["1", "2", "101", "102"]));
    for (const model of ["Building", "RealmKnowledge", "ArmySlot"])
      expect(rowInGameSyncScope(model, { structure_id: "2", epoch: 3 }, scope)).toBe(true);
    expect(rowInGameSyncScope("TileOpt", { alt: false, col: 1600, row: 2700 }, scope)).toBe(false);
    expect(rowInGameSyncScope("TileOccupancy", rows[6].value, scope)).toBe(true);
    expect(rowInGameSyncScope("ActionNonce", { actor: "11" }, scope)).toBe(false);
  });

  it("keeps morning muster on the acting realm even when the visitor has an army", () => {
    const withoutActingArmy: ScopeRowReader = (model, spacing, keys) =>
      read(model, spacing, keys).filter(({ value }) => model !== "ExplorerTroops" || value.owner !== "1");
    const scope = deriveGameSyncScope("0xa", 350, expedition, withoutActingArmy, "0xbbb");
    expect(scope.expedition?.regions).toEqual(new Set(["0:0"]));
  });

  it("drops visit-only rows on leaving and retains overlapping ownership", () => {
    const home = deriveGameSyncScope("0xa", 350, expedition, read);
    expect(rowInGameSyncScope("RealmKnowledge", { structure_id: "2" }, home)).toBe(false);
    expect(rowInGameSyncScope("RealmKnowledge", { structure_id: "1" }, home)).toBe(true);
    expect(deriveGameSyncScope("0xa", 350, expedition, read, "0xa").expedition).toEqual(home.expedition);
    expect(deriveGameSyncScope(undefined, 350, expedition, read, "0xbbb").expedition?.regions).toEqual(new Set());
  });

  it("rejects invalid visit addresses", () => {
    for (const value of ["0x0", `0x${((1n << 251n) - 256n).toString(16)}`])
      expect(() => deriveGameSyncScope("0xa", 350, expedition, read, value)).toThrow("Invalid gameplay account");
  });
});
