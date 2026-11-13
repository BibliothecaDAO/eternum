import { describe, expect, it, vi } from "vitest";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { NativeFactStore } from "../client/native-fact-store";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { getTileAt } from "./tile";
import { availableRuinLords, ruinChestsToday, ruinDisappeared } from "./ruins";
import { nativeReleaseConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
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

const release = (release_id = nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE) => ({
  model: "GameRelease" as const,
  key: "0x61",
  value: { game_id: 1, release_id, created_release_id: 1, preset_commitment: 0n },
});

const setup = () => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, timestamp: 350 });
  store.applyFacts([
    release(),
    {
      model: "SettlementRules",
      key: "0x1",
      value: { game_id: 1, spacing: 100, registration_start: 0, registration_limit: 0, mode: "Single" },
    },
    ...[
      site(first, 40),
      site(second, 41),
      site(otherHome + 1n, 240),
      site(home + 3n, 440),
      site(home + 5n, 140),
    ].flatMap((value, index) => [
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

describe("a realm's daily ruin choice per depth", () => {
  it("removes same-depth ruins atomically, keeps other depths/homes/days, and restores on rollback", () => {
    const store = setup();
    const map = new WorldSpatialProjection({ store });
    map.start();
    expect(map.getStructures(false)).toHaveLength(5);
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
    expect(getTileAt(store, false, 40, 41, 1)?.occupier_id).toBe(0);
    expect(map.getTileAtHex({ alt: false, col: 40, row: 41 })?.occupierId).toBe(0);
    map.rebuild();
    expect(map.getStructure(Number(second))).toBeUndefined();
    expect(map.getStructure(Number(home + 5n))).toBeDefined();
    store.applyFacts([close(false), { model: "ExpeditionSite", key: "0x20", value: site(first, 40) }]);
    map.flush();
    expect(map.getStructure(Number(second))).toBeDefined();
    unsubscribe();
    map.dispose();
  });

  it.each([0, 1, 2, 3])("uses retained clear receipts at depth %i even with the legacy aggregate flag", (depth) => {
    const store = setup();
    const cleared = {
      ...site(first, depth * 100 + 40),
      clear: { explorer_id: home + 4n, home_id: home, reward: { resource_type: 37, amount: 500n } },
    };
    store.applyFacts([close(true), { model: "ExpeditionSite", key: "0x20", value: cleared }]);
    for (const candidateDepth of [0, 1, 2, 3]) {
      expect(ruinDisappeared(store, site(second, candidateDepth * 100 + 41))).toBe(candidateDepth === depth);
    }
    expect(ruinDisappeared(store, site(second, depth * 100 + 440))).toBe(false);
    expect(ruinDisappeared(store, site(otherHome + 1n, depth * 100 + 40))).toBe(false);
    expect(ruinDisappeared(store, cleared)).toBe(false);
    expect(ruinDisappeared(store, { ...site(second, depth * 100 + 40), category: StructureType.Camp })).toBe(false);
    // Snapshot recovery reads the same receipts without an ExpeditionDiscovery diff.
    store.applyFacts([{ model: "ExpeditionDiscovery", key: "0x5", value: null }]);
    expect(ruinDisappeared(store, site(second, depth * 100 + 41))).toBe(true);
  });

  it("reopens other depths atomically on release application and closes a second depth from its receipt", () => {
    const store = setup();
    const receipt = { explorer_id: home + 4n, home_id: home, reward: { resource_type: 37, amount: 500n } };
    store.applyFacts([
      release(nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE - 1),
      close(true),
      { model: "ExpeditionSite", key: "0x20", value: { ...site(first, 40), clear: receipt } },
    ]);
    const map = new WorldSpatialProjection({ store });
    map.start();
    expect(map.getStructure(Number(home + 5n))).toBeUndefined();
    const changed = vi.fn();
    map.subscribeStructures(changed);
    store.applyFacts([release()]);
    map.flush();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(map.getStructure(Number(home + 5n))).toBeDefined();
    expect(map.getStructure(Number(second))).toBeUndefined();
    changed.mockClear();
    store.applyFacts([release(nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE - 1)]);
    map.flush();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(map.getStructure(Number(home + 5n))).toBeUndefined();
    store.applyFacts([release()]);
    map.flush();
    expect(map.getStructure(Number(home + 5n))).toBeDefined();
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x62",
        value: {
          ...site(home + 6n, 141),
          clear: receipt,
        },
      },
    ]);
    map.flush();
    expect(map.getStructure(Number(home + 5n))).toBeUndefined();
    expect(store.get("ExpeditionDiscovery", { game_id: 1, structure_id: home, epoch: 0n })?.ruin_cleared).toBe(true);
    map.dispose();
  });

  it("computes available LORDS using today's unlock, paid amounts and only today's reservations", () => {
    const calendar = { startMainAt: 100, endAt: 1000, dayUnitSeconds: 100, seed: 1n };
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

it("keeps the final day's ruin reservation held through an absorbed bag boundary", () => {
  const rows: Record<string, object> = {
    LordsBudget: { pool: 9000n, pool_left: 8000n, open: 500n, day: 9n },
    GameRegistry: { start_main_at: 0n, end_at: 81n * 3600n, seed: 0x5eedn },
    SliceRules: { day_unit_seconds: 7200 },
  };
  const store = { get: (model: string) => rows[model] } as unknown as Pick<NativeFactStore, "get">;
  for (const at of [68 * 3600, 80 * 3600, 81 * 3600 - 1]) expect(availableRuinLords(store, 1, at)).toBe(7500n);
  expect(availableRuinLords(store, 1, 81 * 3600)).toBe(0n);
});

describe("each depth's ruin chest today", () => {
  const rules = { dayUnitSeconds: 100, spacing: 100, startMainAt: 0, endAt: 100_000, seed: 1n };
  // Realm 7 has gone down to Ethereal I (enter_depth records the deepest layer reached).
  const realm = { game_id: 1, entity_id: 7, metadata: { deepest_depth: 1 } } as never;
  const discovery = (ruin_cleared: boolean) => ({
    model: "ExpeditionDiscovery",
    key: "0x71",
    value: { game_id: 1, structure_id: 7n, epoch: 0n, empty_reveals: 0, ruin_cleared },
  });
  const chests = (releaseId: number, facts: object[]) => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, timestamp: 1 });
    store.applyFacts([
      release(releaseId),
      // Another realm cleared today's Ethereal I: its receipt is not realm 7's.
      {
        model: "ExpeditionSite",
        key: "0x22",
        value: { ...site(otherHome + 1n, 140), clear: { explorer_id: 2n, home_id: 8n, reward: null } },
      },
      ...facts,
    ] as never);
    return ruinChestsToday(store, rules, realm, 1);
  };
  const surfaceClear = {
    model: "ExpeditionSite",
    key: "0x21",
    value: { ...site(home + 1n, 40), clear: { explorer_id: 1n, home_id: 7n, reward: null } },
  };

  it("opens every depth the realm has reached while today's discovery says nothing was cleared, and locks the rest", () => {
    expect(dayOf(rules, 1)?.index).toBe(0);
    expect(chests(nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE, [discovery(false)])).toEqual([
      "open",
      "open",
      "locked",
      "locked",
    ]);
  });

  it("claims a depth by its receipt, and leaves a depth whose region it does not hold unknown, never open", () => {
    // This store has no actor, so it holds no expedition scope: no region's missing receipt says the chest is there.
    expect(chests(nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE, [discovery(true), surfaceClear])).toEqual([
      "claimed",
      "unknown",
      "locked",
      "locked",
    ]);
  });

  it("says nothing before a home clears one ruin per depth", () => {
    expect(chests(nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE - 1, [discovery(false)])).toBeNull();
  });
});
