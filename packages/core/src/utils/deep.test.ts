import { describe, expect, it } from "vitest";
import { BiomeType, BiomeTypeToId, deepSites } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import {
  nativeTilePackingConstants,
  type NativeModelName,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRowDefinitions } from "../client/native-row";
import { currentArmy, currentResourceWeight, deepTerrain, deepTiles } from "./deep";
import { armyCombatRefusal } from "./army-opponents";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import {
  IncompleteDeepSyncError,
  deepBuildingPay,
  readDeepBeastTroops,
  readDeepRingOpening,
  readDeepSite,
  readDeepSites,
} from "../client/views/deep-sites";
import { dayAtIndex } from "./days";

const calendar = { startMainAt: 360, scheduledEndAt: 288360, endAt: 288360, dayUnitSeconds: 14400, seed: 1n };
const precision = 1_000_000_000n;
const fixture = () => {
  const rows: Record<string, Record<string, unknown>[]> = {
    SliceRules: [
      {
        game_id: 7,
        day_unit_seconds: 14400,
        tick_config: { armies_tick_in_seconds: 60n },
        capacity_config: { troop_capacity: 10 },
      },
    ],
    SettlementRules: [{ game_id: 7, spacing: 1024 }],
    GameRegistry: [{ game_id: 7, start_main_at: 360n, scheduled_end_at: 288360n, end_at: 288360n, seed: 1n }],
    DeepRules: [
      {
        game_id: 7,
        loss_per_tick: precision,
        rings: [{ radius: 5, realms: 0 }],
        beasts: [0, 1, 2, 3].map((kind) => ({ count: 10n * precision, bow: kind % 2 === 1 })),
        building_pay: { alone: 6, pair: 3, crowd: 2 },
      },
    ],
    DeepArmy: [{ game_id: 7, explorer_id: 11n, last_tick: 6n }],
    ArmyDay: [{ game_id: 7, explorer_id: 11n, day: 0n }],
    ArmyProgress: [{ game_id: 7, explorer_id: 11n, logistics: 0, oath_slots: 1, oaths: 0, oath_pick: 0 }],
    ExplorerTroops: [{ game_id: 7, explorer_id: 11n, owner: 1n, troops: { count: 10n * precision } }],
    ResourceWeight: [{ game_id: 7, entity_id: 11n, weight: 0n, capacity: 100n * precision }],
    TileOccupancy: [{ game_id: 7, entity_id: 11n, col: 512, row: 3584, alt: false }],
    HomeAspect: [
      { game_id: 7, home: 1n, aspect: 1 },
      { game_id: 7, home: 2n, aspect: 1 },
    ],
  };
  const get = (model: NativeModelName, key: Record<string, unknown>) =>
    rows[model]?.find((row) =>
      nativeRowDefinitions[model].keys.every((name) => String(row[name]) === String(key[name])),
    );
  const store = {
    get,
    require: (model: NativeModelName, key: Record<string, unknown>) => {
      const row = get(model, key);
      if (!row) throw new Error(`missing ${model}`);
      return row;
    },
    requireOrAbsent: (model: NativeModelName, key: Record<string, unknown>) => ({
      known: get(model, key) ?? { count: 0 },
    }),
    entries: (model: string) => (rows[model] ?? []).map((row, index) => [String(index), row]),
    inGame: (model: string, gameId: number) => (rows[model] ?? []).filter((row) => row.game_id === gameId),
    entityOccupancy: (game_id: number, entity_id: bigint) =>
      rows.TileOccupancy?.find((row) => row.game_id === game_id && String(row.entity_id) === String(entity_id)),
  } as unknown as NativeFactStore;
  return { rows, store, army: store.require("ExplorerTroops", { game_id: 7, explorer_id: 11n }) };
};

describe("the shared Deep", () => {
  it("derives exactly 2,500 fixed tiles only when the preset enables Deep", () => {
    const { store, rows } = fixture();
    const tiles = [...deepTiles(store)];
    expect(tiles).toHaveLength(2500);
    expect(tiles[0]).toEqual({ game_id: 7, alt: false, col: 487, row: 3559 });
    expect(tiles.at(-1)).toEqual({ game_id: 7, alt: false, col: 536, row: 3608 });
    expect(deepTerrain(store, tiles[0]!)).toEqual({
      data: BigInt(BiomeTypeToId[BiomeType.Underground]) * BigInt(nativeTilePackingConstants.BIOME_SCALE),
    });
    expect(deepTerrain(store, { ...tiles[0]!, col: 486 })).toBeUndefined();
    expect(deepTerrain(store, { ...tiles[0]!, alt: true })).toBeUndefined();
    rows.DeepRules = [];
    expect([...deepTiles(store)]).toEqual([]);
    expect(deepTerrain(store, tiles[0]!)).toBeUndefined();
  });

  it("projects count and capacity from the last paid tick without changing or charging the source twice", () => {
    const { store, army } = fixture();
    expect(currentArmy(store, army, 419).troops.count).toBe(10n * precision);
    const atTick = currentArmy(store, army, 420);
    expect(atTick.troops.count).toBe(9n * precision);
    expect(currentArmy(store, atTick, 480).troops.count).toBe(8n * precision);
    expect(army.troops.count).toBe(10n * precision);
    const weight = store.require("ResourceWeight", { game_id: 7, entity_id: 11n });
    expect(currentResourceWeight(store, weight, 480).capacity).toBe(80n * precision);
    expect(weight.capacity).toBe(100n * precision);
    expect(currentArmy(store, army, 960).troops.count).toBe(0n);
  });

  it("stops charging at the allocated day's end and rejects missing cursor prerequisites", () => {
    const { rows, store } = fixture();
    const end = dayAtIndex(calendar, 0).end;
    rows.DeepArmy![0]!.last_tick = BigInt(end / 60 - 1);
    const army = store.require("ExplorerTroops", { game_id: 7, explorer_id: 11n });
    expect(currentArmy(store, army, end + 3600).troops.count).toBe(9n * precision);
    rows.ArmyDay = [];
    expect(() => currentArmy(store, army, end)).toThrow("requires its rules and army facts");
  });

  it("refuses an army target where the game leaves the army battle out, while Blitz keeps army fights", () => {
    const { rows, store, army } = fixture();
    const enemy = { ...army, explorer_id: 12n, owner: 2n };
    rows.ExplorerTroops!.push(enemy);
    rows.TileOccupancy!.push({ game_id: 7, entity_id: 12n, col: 513, row: 3584, alt: false });
    rows.SliceRules![0]!.command_mask = 0n;
    expect(armyCombatRefusal(store, army, enemy)).toBe("no-attack");
    rows.SliceRules![0]!.command_mask = BigInt(nativeCommandBits.Battle);
    expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
  });

  it("reads a later ring's site closed, with the count that opens it, until today's entries reach that count", () => {
    const { rows, store } = fixture();
    rows.DeepRules![0]!.rings = [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 2 },
    ];
    rows.DeepSite = [{ game_id: 7, entity_id: 24n, kind: 0, ring: 1, day: 0n }];
    rows.Guard = [{ game_id: 7, structure_id: 24n, slot: 0, troops: { count: 10n * precision } }];
    rows.TileOccupancy!.push({ game_id: 7, entity_id: 24n, col: 505, row: 3584, alt: false });
    expect(readDeepSite(store, 420, 24n, 7)).toMatchObject({ open: false, opensAt: 2 });
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 1 }];
    expect(readDeepSite(store, 420, 24n, 7)?.open).toBe(false);
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 2 }];
    expect(readDeepSite(store, 420, 24n, 7)?.open).toBe(true);
  });

  it("reads a Foundation's pay a tick as the pair, then the crowd, as today's entries open more Foundations", () => {
    const { rows, store } = fixture();
    rows.DeepRules![0]!.rings = [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 2 },
      { radius: 11, realms: 3 },
    ];
    rows.DeepSite = [0, 1, 2].map((ring) => ({ game_id: 7, entity_id: BigInt(24 + ring), kind: 0, ring, day: 0n }));
    rows.DeepSite.push({ game_id: 7, entity_id: 27n, kind: 3, ring: 1, day: 0n });
    rows.Guard = rows.DeepSite.map((site) => ({
      game_id: 7,
      structure_id: site.entity_id,
      slot: 0,
      troops: { count: 10n * precision },
    }));
    rows.TileOccupancy!.push(
      ...rows.DeepSite.map((site) => ({
        game_id: 7,
        entity_id: site.entity_id,
        col: 481 + Number(site.entity_id),
        row: 3584,
        alt: false,
      })),
    );
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 1 }];
    expect(readDeepSite(store, 420, 24n, 7)?.buildingPay).toBe(6);
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 2 }];
    expect(readDeepSite(store, 420, 24n, 7)?.buildingPay).toBe(3);
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 3 }];
    expect(readDeepSite(store, 420, 24n, 7)?.buildingPay).toBe(2);
  });

  it("reads a closed site's pay as it will be once its ring opens, with every site of its kind that opening adds", () => {
    const { rows, store } = fixture();
    rows.DeepRules![0]!.rings = [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 50 },
    ];
    rows.DeepSite = [0, 1, 1, 1].map((ring, index) => ({
      game_id: 7,
      entity_id: BigInt(24 + index),
      kind: 0,
      ring,
      day: 0n,
    }));
    rows.Guard = rows.DeepSite.map((site) => ({
      game_id: 7,
      structure_id: site.entity_id,
      slot: 0,
      troops: { count: 10n * precision },
    }));
    rows.TileOccupancy!.push(
      ...rows.DeepSite.map((site) => ({
        game_id: 7,
        entity_id: site.entity_id,
        col: 481 + Number(site.entity_id),
        row: 3584,
        alt: false,
      })),
    );
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 1 }];
    const pay = rows.DeepRules![0]!.building_pay;
    expect(readDeepSite(store, 420, 24n, 7)).toMatchObject({ open: true, buildingPay: pay.alone });
    expect(readDeepSite(store, 420, 25n, 7)).toMatchObject({ open: false, buildingPay: pay.crowd });
  });

  it("reads a ring opened yesterday closed today until today's entries reach it, before the sites roll over", () => {
    const { rows, store } = fixture();
    rows.DeepRules![0]!.rings = [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 2 },
    ];
    rows.DeepSite = [{ game_id: 7, entity_id: 24n, kind: 0, ring: 1, day: 0n }];
    rows.Guard = [{ game_id: 7, structure_id: 24n, slot: 0, troops: { count: 10n * precision } }];
    rows.TileOccupancy!.push({ game_id: 7, entity_id: 24n, col: 505, row: 3584, alt: false });
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 2 }];
    const tomorrow = dayAtIndex(calendar, 0).end;
    expect(readDeepSite(store, 420, 24n, 7)?.open).toBe(true);
    expect(readDeepSite(store, tomorrow, 24n, 7)?.open).toBe(false);
    rows.DeepEntries = [...rows.DeepEntries, { game_id: 7, day: 1n, count: 2 }];
    expect(readDeepSite(store, tomorrow, 24n, 7)?.open).toBe(true);
  });

  it("tells the map a ring's opening, and that it is not known yet while today's entries are still arriving", () => {
    const { rows, store } = fixture();
    rows.DeepRules![0]!.rings = [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 30 },
    ];
    rows.DeepSite = [{ game_id: 7, entity_id: 24n, kind: 0, ring: 1, day: 0n }];
    rows.Guard = [{ game_id: 7, structure_id: 24n, slot: 0, troops: { count: 10n * precision } }];
    rows.TileOccupancy!.push({ game_id: 7, entity_id: 24n, col: 505, row: 3584, alt: false });
    rows.DeepEntries = [{ game_id: 7, day: 0n, count: 12 }];
    expect(readDeepRingOpening(store, 420, 24n, 7)).toEqual({ known: { open: false, realms: 30 } });
    const arriving = { ...store, requireOrAbsent: () => ({ unknown: "INCOMPLETE_SNAPSHOT: DeepEntries" }) };
    expect(readDeepRingOpening(arriving as never, 420, 24n, 7)).toEqual({
      unknown: "INCOMPLETE_SNAPSHOT: DeepEntries",
    });
    expect(() => readDeepSite(arriving as never, 420, 24n, 7)).toThrow("Realms entered today are unknown");
  });

  it("reads a ring's six sites in place order, highest live guard first, then restores next-day beasts", () => {
    const { rows, store } = fixture();
    const kinds = [0, 1, 2, 3, 0, 2];
    rows.DeepSite = kinds
      .map((kind, place) => ({ game_id: 7, entity_id: BigInt(20 + place), kind, ring: 0, day: 0n }))
      .reverse();
    rows.Guard = rows.DeepSite.map((site) => ({
      game_id: 7,
      structure_id: site.entity_id,
      slot: 0,
      troops: { count: 0n },
    }));
    rows.TileOccupancy!.push(
      ...rows.DeepSite.map((site) => ({
        game_id: 7,
        entity_id: site.entity_id,
        col: 480 + Number(site.entity_id),
        row: 3584,
        alt: false,
      })),
    );
    rows.ExplorerTroops!.push({ game_id: 7, explorer_id: 12n, owner: 2n, troops: { count: 20n * precision } });
    rows.DeepArmy!.push({ game_id: 7, explorer_id: 12n, last_tick: 6n });
    rows.ArmyDay!.push({ game_id: 7, explorer_id: 12n, day: 0n });
    rows.ArmyProgress!.push({ ...rows.ArmyProgress![0], explorer_id: 12n });
    rows.DeepGuard = [
      { game_id: 7, explorer_id: 11n, site_id: 20n, slot: 0 },
      { game_id: 7, explorer_id: 12n, site_id: 20n, slot: 3 },
    ];
    const today = readDeepSites(store, 420, 7);
    expect(today.map((site) => site.name)).toEqual(kinds.map((kind) => deepSites[kind]!.name));
    expect(today.every((site) => site.open && site.ring === 0)).toBe(true);
    expect(today[0]!.guards.map(({ slot, army }) => [slot, army.troops.count])).toEqual([
      [3, 19n * precision],
      [0, 9n * precision],
    ]);
    const tomorrow = readDeepSites(store, dayAtIndex(calendar, 0).end, 7);
    expect(tomorrow.map((site) => [site.id, site.beastTroops, site.guards])).toEqual(
      kinds.map((_, place) => [BigInt(20 + place), 10n * precision, []]),
    );
    rows.DeepSite.pop();
    expect(() => readDeepSites(store, 420, 7)).toThrow(IncompleteDeepSyncError);
    expect(() => readDeepSites(store, 420, 7)).toThrow("Incomplete Deep site facts");
  });

  it("throws IncompleteDeepSyncError when day entries are unknown, plain Error on missing rules, and empty outside the game window", () => {
    const { rows, store } = fixture();
    rows.DeepRules = [
      {
        game_id: 7,
        loss_per_tick: precision,
        rings: [{ radius: 5, realms: 0 }],
        beasts: deepSites.map(() => ({ count: 10n * precision, bow: false })),
        building_pay: { alone: 6, pair: 3, crowd: 2 },
      },
    ];
    rows.DeepSite = Array.from({ length: nativeRuleConstants.DEEP_RING_SITES }, (_, place) => ({
      game_id: 7,
      entity_id: BigInt(20 + place),
      kind: deepSites[place % deepSites.length]!.id,
      ring: 0,
      day: 0n,
    }));
    const unknownEntriesStore = {
      ...store,
      requireOrAbsent: () => ({ unknown: "INCOMPLETE_SNAPSHOT: DeepEntries" }),
    } as unknown as NativeFactStore;
    expect(() => readDeepSites(unknownEntriesStore, 420, 7)).toThrow(IncompleteDeepSyncError);
    expect(() => readDeepSites(unknownEntriesStore, 420, 7)).toThrow("INCOMPLETE_SNAPSHOT: DeepEntries");
    expect(readDeepSites(store, 0, 7)).toEqual([]);
    rows.DeepRules = [];
    let rulesError: unknown;
    try {
      readDeepSites(store, 420, 7);
    } catch (error) {
      rulesError = error;
    }
    expect(rulesError).toBeInstanceOf(Error);
    expect(rulesError).not.toBeInstanceOf(IncompleteDeepSyncError);
    expect((rulesError as Error).message).toContain("Deep sites are missing their preset rules");
  });

  it("reads a site's beast from its guard and the day alone, before the day's entries are known", () => {
    const { rows, store } = fixture();
    rows.DeepRules = [{ game_id: 7, loss_per_tick: precision, beasts: [{ count: 10n * precision, bow: false }] }];
    rows.DeepSite = [{ game_id: 7, entity_id: 20n, kind: 0, ring: 0, day: 0n }];
    rows.Guard = [{ game_id: 7, structure_id: 20n, slot: 0, troops: { count: 4n * precision } }];
    expect(readDeepBeastTroops(store, 420, 20n, 7)).toBe(4n * precision);
    expect(readDeepBeastTroops(store, dayAtIndex(calendar, 0).end, 20n, 7)).toBe(10n * precision);
    expect(readDeepBeastTroops(store, 420, 21n, 7)).toBeUndefined();
  });
});

it("projects Vitriol's exact native troop vectors and refuses a missing progress record", async () => {
  const { readFileSync } = await import("node:fs");
  const { deepArmyLife } = await import("./deep-army-life");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-deep-loss.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  expect(fields.length).toBe(48);
  while (fields.length) {
    const [held, base, troops, ticks, expectedLoss, expectedTroops] = fields.splice(0, 6) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    const { rows, store } = fixture();
    rows.ArmyProgress![0]!.oaths = Number(held);
    rows.DeepRules![0]!.loss_per_tick = base;
    rows.ExplorerTroops![0]!.troops = { count: troops };
    const source = store.require("ExplorerTroops", { game_id: 7, explorer_id: 11n });
    const now = 360 + Number(ticks) * 60;
    const projected = currentArmy(store, source, now);
    expect(projected.troops.count).toBe(expectedTroops);
    expect(deepArmyLife(store, projected, now)).toMatchObject({
      lossPerTick: expectedLoss,
      ticksToEmpty: Number((expectedTroops + expectedLoss - 1n) / expectedLoss),
    });
    expect(currentArmy(store, projected, now).troops.count).toBe(expectedTroops);
    expect(source.troops.count).toBe(troops);
    rows.ArmyProgress = [];
    expect(() => currentArmy(store, source, now)).toThrow("army progress");
  }
});

it("pays a Foundation or Altar by the native building-pay vectors for each count of open sites of its kind", async () => {
  const { readFileSync } = await import("node:fs");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/deep-building-pay.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  expect(fields.length).toBe(30);
  while (fields.length) {
    const [alone, pair, crowd, open, expected] = fields.splice(0, 5) as [number, number, number, number, number];
    expect(deepBuildingPay({ alone, pair, crowd }, open)).toBe(expected);
  }
});
