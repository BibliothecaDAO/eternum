import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { musterArmy, musterDirection, musterMaximum, previewMuster, readMusterPlan } from "./muster-plan";

const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const realm = {
  game_id: 1,
  entity_id: 7,
  owner: "0x111",
  base: {
    category: 1,
    level: 0,
    created_at: "0x1",
    troop_max_guard_count: 0,
    troop_max_explorer_count: 3,
    starting_troops_granted: false,
  },
  resources_packed: "0x0",
  metadata: {
    realm_id: 1,
    village_realm: 0,
    mine_kind: 0,
    attunement: 0,
    barracks_tier: 0,
    has_wonder: false,
    order: 0,
  },
};

/** A Frontier day at epoch 3: the realm owns 420 T1 knights and one of its three slots holds an army. */
const frontierDay = () => {
  const store = new NativeFactStore();
  store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 })] as never);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts([
    set("0x2", "SettlementRules", {
      game_id: 1,
      registration_start: 1,
      registration_limit: 2,
      spacing: 10,
      mode: "Single",
    }),
    set("0x3", "GameRegistry", {
      game_id: 1,
      preset_id: 3,
      name: "1",
      creator: "1",
      start_settling_at: "1",
      start_main_at: "100",
      end_at: "1000",
      settled: false,
      ready: true,
      dev_mode_on: false,
      end_grace_seconds: 0,
      seed: "1",
    }),
    set("0x7", "Structure", realm),
    ...preset.resources.map((rule) => set(`0x5${rule.resource_type}`, "ResourceRule", { ...rule, game_id: 1 })),
    set("0x6", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: "100000000000000", weight: "0" }),
    set("0x8", "ResourceBalance", {
      game_id: 1,
      entity_id: 7,
      resource_type: 26,
      balance: String(420n * BigInt(RESOURCE_PRECISION)),
    }),
    set("0x9", "ArmySlot", {
      game_id: 1,
      structure_id: 7,
      epoch: "3",
      slot: 0,
      explorer_id: 70,
      stamina: { amount: "30", updated_tick: "3" },
    }),
  ] as never);
  setBlockTimestampSource(() => 350);
  configManager.setActiveGame(1, 3);
  configManager.setStore(store);
  return { store, row: store.require("Structure", { game_id: 1, entity_id: 7 }) };
};

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("Frontier's muster", () => {
  it("offers only the troops the realm holds, and the slot the next army fills", () => {
    const { store, row } = frontierDay();
    const plan = readMusterPlan(store, row, 3)!;
    expect(plan.slots).toEqual({ used: 1, allowed: 3 });
    expect(plan.next).toEqual({ slot: 1, inherited: null });
    expect(plan.stacks.map(({ type, tier, available }) => ({ type, tier, available }))).toEqual([
      { type: TroopType.Knight, tier: TroopTier.T1, available: 420 },
    ]);
    expect(musterMaximum({ ...plan.stacks[0], cap: 300 })).toBe(300);
  });

  it("previews the army a count makes, never past what the realm can field", () => {
    const { store, row } = frontierDay();
    const plan = readMusterPlan(store, row, 3)!;
    const stack = plan.stacks[0];
    const preview = previewMuster(store, 1, plan, stack, 10_000, 3);
    expect(preview.count).toBe(musterMaximum(stack));
    expect(preview.strength).toBeGreaterThan(0);
    expect(preview.stamina?.max).toBeGreaterThan(0);
    // No depth rules loaded: the yield is unknown, never zero.
    expect(preview.revealYield).toBeUndefined();
  });

  it("steps out on the first explored open hex around the realm, and nowhere while the ring is unknown or taken", () => {
    const { store, row } = frontierDay();
    expect(musterDirection(store, row, () => 0)).not.toBeNull();
    expect(musterDirection(store, row, () => undefined)).toBeNull();
    expect(musterDirection(store, row, () => 1)).toBeNull();
  });

  it("musters the chosen stack and count in the given direction", async () => {
    const { store, row } = frontierDay();
    const stack = readMusterPlan(store, row, 3)!.stacks[0];
    const createExplorerArmy = vi.fn(() => Promise.resolve());
    await musterArmy({ createExplorerArmy }, row, stack, 120, 2);
    expect(createExplorerArmy).toHaveBeenCalledWith({
      structureId: 7,
      troopType: TroopType.Knight,
      troopTier: TroopTier.T1,
      troopCount: 120,
      spawnDirection: 2,
    });
  });
});
