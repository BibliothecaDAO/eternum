import { describe, expect, it } from "vitest";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeTilePackingConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { currentArmy, currentResourceWeight, deepTerrain, deepTiles } from "./deep";
import { armyCombatRefusal } from "./army-opponents";
import { readDeepSites } from "../client/views/deep-sites";
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
    DeepRules: [{ game_id: 7, loss_per_tick: precision, beast_count: 10n * precision }],
    DeepArmy: [{ game_id: 7, explorer_id: 11n, last_tick: 6n }],
    ArmyDay: [{ game_id: 7, explorer_id: 11n, day: 0n }],
    ExplorerTroops: [{ game_id: 7, explorer_id: 11n, owner: 1n, troops: { count: 10n * precision } }],
    ResourceWeight: [{ game_id: 7, entity_id: 11n, weight: 0n, capacity: 100n * precision }],
    TileOccupancy: [{ game_id: 7, entity_id: 11n, col: 512, row: 3584, alt: false }],
    HomeAspect: [
      { game_id: 7, home: 1n, aspect: 1 },
      { game_id: 7, home: 2n, aspect: 1 },
    ],
  };
  const get = (model: string, key: Record<string, unknown>) =>
    rows[model]?.find((row) => Object.entries(key).every(([name, value]) => String(row[name]) === String(value)));
  const store = {
    get,
    require: (model: string, key: Record<string, unknown>) => {
      const row = get(model, key);
      if (!row) throw new Error(`missing ${model}`);
      return row;
    },
    entries: (model: string) => (rows[model] ?? []).map((row, index) => [String(index), row]),
    inGame: (model: string, gameId: number) => (rows[model] ?? []).filter((row) => row.game_id === gameId),
    entityOccupancy: (game_id: number, entity_id: bigint) => get("TileOccupancy", { game_id, entity_id }),
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

  it("refuses allied targets and personal-map combat while retaining Blitz's opponent rules", () => {
    const { rows, store, army } = fixture();
    const enemy = { ...army, explorer_id: 12n, owner: 2n };
    rows.ExplorerTroops!.push(enemy);
    rows.TileOccupancy!.push({ game_id: 7, entity_id: 12n, col: 513, row: 3584, alt: false });
    expect(armyCombatRefusal(store, army, enemy)).toBe("allied");
    rows.HomeAspect![1]!.aspect = 2;
    expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
    rows.TileOccupancy![1]!.row = 512;
    expect(armyCombatRefusal(store, army, enemy)).toBe("no-attack");
    rows.SliceRules![0]!.day_unit_seconds = 0;
    expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
  });

  it("reads all sites in catalog order, highest live guard first, then restores next-day beasts", () => {
    const { rows, store } = fixture();
    rows.DeepSite = [2, 0, 1].map((kind) => ({ game_id: 7, entity_id: BigInt(20 + kind), kind, day: 0n }));
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
        col: 500 + Number(site.kind),
        row: 3584,
        alt: false,
      })),
    );
    rows.ExplorerTroops!.push({ game_id: 7, explorer_id: 12n, owner: 2n, troops: { count: 20n * precision } });
    rows.DeepArmy!.push({ game_id: 7, explorer_id: 12n, last_tick: 6n });
    rows.ArmyDay!.push({ game_id: 7, explorer_id: 12n, day: 0n });
    rows.DeepGuard = [
      { game_id: 7, explorer_id: 11n, site_id: 20n, slot: 0 },
      { game_id: 7, explorer_id: 12n, site_id: 20n, slot: 3 },
    ];
    const today = readDeepSites(store, 420, 7);
    expect(today.map((site) => site.name)).toEqual(["Foundation", "Quarry", "Altar"]);
    expect(today[0]!.guards.map(({ slot, army }) => [slot, army.troops.count])).toEqual([
      [3, 19n * precision],
      [0, 9n * precision],
    ]);
    const tomorrow = readDeepSites(store, dayAtIndex(calendar, 0).end, 7);
    expect(tomorrow.map((site) => [site.id, site.beastTroops, site.guards])).toEqual(
      [20n, 21n, 22n].map((id) => [id, 10n * precision, []]),
    );
    rows.DeepSite.pop();
    expect(() => readDeepSites(store, 420, 7)).toThrow("Incomplete Deep site facts");
  });
});
