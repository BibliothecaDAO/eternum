import { dayOf } from "../utils/days";
import { TileOccupier } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { rowInGameSyncScope } from "./model-manifest";
import { deriveGameSyncScope, scopeInputKeys, type ScopeRowReader } from "./subscription-scope";

// Day 0 runs from 300 for at least three 60 s units, so t=350 is on it.
const expedition = {
  dayUnitSeconds: 60,
  spacing: 1024,
  startMainAt: 300,
  scheduledEndAt: 300 + 21 * 20 * 60,
  endAt: 300 + 21 * 20 * 60,
  seed: 1n,
};
const rows = [
  { model: "ArmyDay", value: { explorer_id: "101", day: "0" } },
  { model: "ArmyDay", value: { explorer_id: "102", day: "0" } },
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
    expect(scope.expedition?.regions).toEqual(new Set(["0:0", "0:1"]));
    expect(scope.expedition?.entities).toEqual(new Set(["1", "2", "101", "102"]));
    for (const model of ["Building", "RealmKnowledge", "ArmySlot"])
      expect(rowInGameSyncScope(model, { structure_id: "2", epoch: 0 }, scope)).toBe(true);
    expect(rowInGameSyncScope("TileOpt", { alt: false, col: 1600, row: 2700 }, scope)).toBe(false);
    const visitedArmyTile = rows.find((row) => row.model === "TileOccupancy" && row.value.entity_id === "102")!;
    expect(rowInGameSyncScope("TileOccupancy", visitedArmyTile.value, scope)).toBe(true);
    expect(rowInGameSyncScope("GameplayRejected", { actor: "11" }, scope)).toBe(false);
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
  });

  it("gives a spectator the watched realm's tiles without its actor-only events", () => {
    const scope = deriveGameSyncScope(undefined, 350, expedition, read, "0xbbb");
    expect(scope.actor).toBeUndefined();
    expect(scope.expedition?.regions).toEqual(new Set(["1:0", "1:2"]));
    expect(rowInGameSyncScope("TileOpt", { alt: false, col: 1600, row: 2700 }, scope)).toBe(true);
    expect(rowInGameSyncScope("TileOpt", { alt: false, col: 512, row: 1600 }, scope)).toBe(false);
    expect(rowInGameSyncScope("GameplayRejected", { actor: "11" }, scope)).toBe(false);
    expect(deriveGameSyncScope(undefined, 350, expedition, read).expedition?.regions).toEqual(new Set());
    expect(deriveGameSyncScope(undefined, 350, expedition, read, "0xa").expedition?.regions).toEqual(
      new Set(["0:0", "0:1"]),
    );
  });

  it("rejects invalid visit addresses", () => {
    for (const value of ["0x0", `0x${((1n << 251n) - 256n).toString(16)}`])
      expect(() => deriveGameSyncScope("0xa", 350, expedition, read, value)).toThrow("Invalid gameplay account");
  });
});

it("keeps the home's surface and its ring while every army stands in an Ethereal layer, and moves it with the day", () => {
  // Realm 1's only army stands at row 1600, Ethereal I (band 1) below day 0's surface region 0:0, where the realm stands
  // at (512, 512); the owner's production stream lost exactly that surface (reports: prod deploy bug, 4 November).
  const scope = deriveGameSyncScope("0xa", 350, expedition, read);
  expect(scope.expedition?.regions).toEqual(new Set(["0:0", "0:1"]));
  const ring = [
    [513, 512],
    [511, 512],
    [512, 511],
    [512, 513],
  ];
  for (const [col, row] of ring) {
    expect(rowInGameSyncScope("TileOpt", { alt: false, col, row }, scope)).toBe(true);
    expect(rowInGameSyncScope("TileOccupancy", { entity_id: "0", category: "0", alt: false, col, row }, scope)).toBe(
      true,
    );
  }
  // Day 1's surface is four bands down; yesterday's home region leaves the scope with the day.
  const tomorrow = deriveGameSyncScope("0xa", dayOf(expedition, 350)!.end, expedition, read);
  expect(tomorrow.expedition?.regions).toEqual(new Set(["0:4"]));
});

it("retains the cleared site's facts by its own coordinate, then drops yesterday's region", () => {
  const site = { model: "ExpeditionSite", value: { entity_id: "999", alt: false, col: 513, row: 1600 } };
  const withSite: ScopeRowReader = (model, spacing, keys) =>
    [...rows, site].filter(
      (row) => row.model === model && scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
    );
  const today = deriveGameSyncScope("0xa", 350, expedition, withSite);
  expect(today.expedition?.entities.has("999")).toBe(true);
  for (const model of ["Structure", "SiteChest", "ExpeditionSite"])
    expect(rowInGameSyncScope(model, site.value, today)).toBe(true);
  const tomorrow = deriveGameSyncScope("0xa", dayOf(expedition, 350)!.end, expedition, withSite);
  expect(tomorrow.expedition?.entities.has("999")).toBe(false);
  expect(rowInGameSyncScope("ExpeditionSite", site.value, tomorrow)).toBe(false);
});

it.each([
  [TileOccupier.Chest, "SiteChest"],
  [TileOccupier.Shrine, "ShrineReward"],
] as const)("includes visible site %s and its %s reward through the tile occupancy", (category, rewardModel) => {
  const chest = {
    model: "TileOccupancy",
    value: {
      entity_id: "900",
      category: String(category),
      is_structure: false,
      alt: false,
      col: 513,
      row: 1600,
    },
  };
  const withChest: ScopeRowReader = (model, spacing, keys) => [
    ...read(model, spacing, keys),
    ...[chest].filter(
      (row) => row.model === model && scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
    ),
  ];
  const visible = deriveGameSyncScope("0xa", 350, expedition, withChest);
  expect(visible.expedition?.entities.has("900")).toBe(true);
  expect(rowInGameSyncScope(rewardModel, { entity_id: "900" }, visible)).toBe(true);
  expect(scopeInputKeys("TileOccupancy", chest.value, 1024)).toEqual(
    category === TileOccupier.Chest
      ? ["TileOccupancy.region:0:1"]
      : ["TileOccupancy.entity:900", "TileOccupancy.region:0:1"],
  );
  const gone = deriveGameSyncScope("0xa", 350, expedition, read);
  expect(rowInGameSyncScope(rewardModel, { entity_id: "900" }, gone)).toBe(false);
  expect(
    rowInGameSyncScope(
      rewardModel,
      { entity_id: "900" },
      deriveGameSyncScope(undefined, 350, expedition, withChest, "0xbbb"),
    ),
  ).toBe(false);
});

it("drops expired armies before reading positions on the shared map", () => {
  const nextDay = dayOf(expedition, 350)!.end;
  const nextRows = [
    ...rows.filter((row) => row.model !== "TileOccupancy"),
    { model: "ExplorerTroops", value: { explorer_id: "103", owner: "1", troops: { count: "1000000000" } } },
    { model: "ArmyDay", value: { explorer_id: "103", day: "1" } },
    { model: "TileOccupancy", value: { entity_id: "103", category: "26", alt: false, col: 512, row: 1600 } },
  ];
  const readNext: ScopeRowReader = (model, spacing, keys) =>
    nextRows.filter(
      (row) => row.model === model && scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
    );
  const scope = deriveGameSyncScope("0xa", nextDay, expedition, readNext);
  expect(scope.expedition!.entities.has("103")).toBe(true);
  expect(scope.expedition!.entities.has("101")).toBe(false);
  expect(scope.expedition!.day).toBe(1);
});

it("includes shared Deep field armies and all held guards with their home facts", () => {
  const extra: typeof rows = [
    { model: "DeepSite", value: { entity_id: "200", kind: 0, day: "0" } },
    { model: "TileOccupancy", value: { entity_id: "200", category: "46", alt: false, col: 512, row: 3584 } },
    { model: "TileOccupancy", value: { entity_id: "301", category: "26", alt: false, col: 511, row: 3584 } },
    { model: "DeepGuard", value: { explorer_id: "302", site_id: "200", slot: 3 } },
    { model: "ExplorerTroops", value: { explorer_id: "301", owner: "8", troops: { count: "1000000000" } } },
    { model: "ExplorerTroops", value: { explorer_id: "302", owner: "9", troops: { count: "1000000000" } } },
  ];
  const shared: ScopeRowReader = (model, spacing, keys) =>
    [...rows, ...extra].filter(
      (row) => row.model === model && scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
    );
  const scope = deriveGameSyncScope("0xa", 350, expedition, shared);
  expect(scope.expedition?.regions).toContain("0:3");
  for (const id of ["200", "301", "302", "8", "9"]) expect(scope.expedition?.entities).toContain(id);
  expect(rowInGameSyncScope("ExplorerTroops", { explorer_id: "302", owner: "9" }, scope)).toBe(true);
  expect(rowInGameSyncScope("DeepArmy", { explorer_id: "302" }, scope)).toBe(true);
  expect(rowInGameSyncScope("Structure", { entity_id: "9" }, scope)).toBe(true);
});
