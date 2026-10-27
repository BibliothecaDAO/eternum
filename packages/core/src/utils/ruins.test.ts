import { describe, expect, it, vi } from "vitest";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { NativeFactStore } from "../client/native-fact-store";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { getTileAt } from "./tile";
import { availableRuinLords } from "./ruins";
import { dayOf } from "./days";

const home = 7n * 0x100000000n + 1n;
const first = home + 1n;
const second = home + 2n;
const otherHome = 8n * 0x100000000n + 1n;
const site = (entity_id: bigint, row: number) => ({
  game_id: 1,
  entity_id,
  category: StructureType.Ruin,
  initial_guard_count: 2000n,
  alt: false,
  col: 40,
  row,
  clear: null,
});

const setup = () => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, timestamp: 350 });
  store.applyFacts([
    {
      model: "SettlementRules",
      key: "0x1",
      value: { game_id: 1, spacing: 100, registration_start: 0, registration_limit: 0, mode: "Single" },
    },
    ...[site(first, 40), site(second, 140), site(otherHome + 1n, 240), site(home + 3n, 440)].flatMap((value, index) => [
      { model: "ExpeditionSite", key: `0x2${index}`, value },
      {
        model: "TileOpt",
        key: `0x3${index}`,
        value: { game_id: 1, alt: false, col: value.col, row: value.row, data: 4n << 41n },
      },
      {
        model: "TileOccupancy",
        key: `0x4${index}`,
        value: {
          game_id: 1,
          alt: false,
          col: value.col,
          row: value.row,
          entity_id: value.entity_id,
          category: TileOccupier.Ruin,
          is_structure: true,
        },
      },
    ]),
  ]);
  return store;
};
const close = (closed: boolean) => ({
  model: "ExpeditionDiscovery" as const,
  key: "0x5",
  value: {
    game_id: 1,
    structure_id: home,
    epoch: 0n,
    empty_reveals: 0,
    ruin_cleared: closed,
  },
});

describe("a realm's daily ruin choice", () => {
  it("removes every other ruin in the same atomic map update, keeps other homes/days, and restores on rollback", () => {
    const store = setup();
    const map = new WorldSpatialProjection({ store });
    map.start();
    expect(map.getStructures(false)).toHaveLength(4);
    const notifications = vi.fn();
    const unsubscribe = map.subscribeStructures(notifications);
    store.applyFacts([
      close(true),
      { model: "TileOccupancy", key: "0x40", value: null },
      {
        model: "ExpeditionSite",
        key: "0x20",
        value: {
          ...site(first, 40),
          clear: {
            explorer_id: home + 4n,
            home_id: home,
            reward: { resource_type: 37, amount: 500n },
          },
        },
      },
    ]);
    map.flush();
    expect(notifications).toHaveBeenCalledTimes(1);
    expect(map.getStructure(Number(first))?.clearedSite).toBe(true);
    expect(map.getStructure(Number(second))).toBeUndefined();
    expect(map.getStructure(Number(otherHome + 1n))).toBeDefined();
    expect(map.getStructure(Number(home + 3n))).toBeDefined();
    expect(getTileAt(store, false, 40, 140, 1)?.occupier_id).toBe(0);
    expect(map.getTileAtHex({ alt: false, col: 40, row: 140 })?.occupierId).toBe(0);
    map.rebuild();
    expect(map.getStructure(Number(second))).toBeUndefined();
    store.applyFacts([close(false)]);
    map.flush();
    expect(map.getStructure(Number(second))).toBeDefined();
    unsubscribe();
    map.dispose();
  });

  it("computes available LORDS using today's unlock, paid amounts and only today's reservations", () => {
    const calendar = { startMainAt: 100, dayUnitSeconds: 100, seed: 1n };
    const day = dayOf(calendar, 350)!;
    const budget = { pool: 9000n, pool_left: 8000n, open: 500n, day: BigInt(day.index) };
    const rows: Record<string, object> = {
      LordsBudget: budget,
      GameRegistry: { start_main_at: 100n, end_at: 1000n, seed: 1n },
      SliceRules: { day_unit_seconds: 100 },
    };
    const store = { get: (model: string) => rows[model] } as unknown as Pick<NativeFactStore, "get">;
    const unlocked = (9000n * BigInt(day.end - 100)) / 900n;
    expect(availableRuinLords(store, 1, 350)).toBe(unlocked - 1500n);
    budget.day = BigInt(day.index - 1);
    expect(availableRuinLords(store, 1, 350)).toBe(unlocked - 1000n);
    budget.pool_left = 0n;
    expect(availableRuinLords(store, 1, 350)).toBe(0n);
    expect(availableRuinLords(store, 1, 1000)).toBe(0n);
  });
});
