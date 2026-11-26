import { getBalance, readExpeditionRules, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, TileOccupier } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";

import { frontierDay } from "./deploy/deploy-fixture";
import { readRealmStore } from "./realm-stores";

afterEach(() => setBlockTimestampSource(null));

describe("the realm's stores", () => {
  it("reads troops against the store's limit, ember at the limit", () => {
    const { store, row } = frontierDay();
    const rules = readExpeditionRules(store, 1)!;
    const clock = { now: 350, tick: 3 };
    const troops = readRealmStore(store, row, rules, "troops", clock);
    expect(troops.amount).toBe(420);
    // The castle stores troop_store_deploys of its level's full deploys.
    const limit = 2 * store.require("SliceRules", { game_id: 1 }).troop_limit_config.settlement_deployment_cap;
    expect(troops.limit).toBe(limit);
    expect(troops.tone).toBe("calm");
    expect(readRealmStore(store, row, rules, "essence", clock).limit).toBeUndefined();

    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0x8",
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: 26,
          balance: String(BigInt(limit) * BigInt(RESOURCE_PRECISION)),
        },
      },
    ] as never);
    const full = readRealmStore(store, row, rules, "troops", clock);
    expect(full).toMatchObject({ amount: limit, fullIn: 0, tone: "ember" });
  });

  it("raises a held Essence Core's home Essence and Ethereal Mine's home Labor each tick without a command and caps Labor at its store limit", () => {
    const { store, row } = frontierDay();
    const rules = readExpeditionRules(store, 1)!;
    const precision = BigInt(RESOURCE_PRECISION);
    const guardAt = (siteId: number, slot: number, count: bigint) => ({
      game_id: 1,
      structure_id: siteId,
      slot,
      troops: {
        category: "Knight",
        tier: "T1",
        count: String(count),
        stamina: { Inline: { amount: "0", settled_at: 0, remainder: 0 } },
        boosts: {
          incr_damage_dealt_percent_num: 0,
          incr_damage_dealt_end_at: 0,
          decr_damage_gotten_percent_num: 0,
          decr_damage_gotten_end_at: 0,
          incr_stamina_regen_percent_num: 0,
          incr_stamina_regen_seconds_left: 0,
          incr_explore_reward_percent_num: 0,
          incr_explore_reward_end_at: 0,
        },
        battle_cooldown_end: 0,
      },
      destroyed_tick: 0,
    });

    store.applyFacts([
      {
        model: "DeepRules",
        key: "0xdee0",
        value: {
          game_id: 1,
          gate_distance: 24,
          rings: [{ radius: 7, realms: 0 }],
          beasts: [0, 1, 2, 3].map((kind) => ({ count: String(10n * precision), bow: kind % 2 === 1 })),
          loss_per_tick: String(200n * precision),
          core_per_tick: String(300n * precision),
          mine_per_tick: String(300n * precision),
          building_pay: { alone: 6, pair: 3, crowd: 2 },
          altar_threshold: 1500,
        },
      },
      { model: "DeepTick", key: "0xdee1", value: { game_id: 1, paid_tick: 1 } },
      {
        model: "ResourceBalance",
        key: "0xdee2",
        value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Essence, balance: String(100n * precision) },
      },
      {
        model: "ResourceBalance",
        key: "0xdee3",
        value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance: String(4800n * precision) },
      },
      {
        model: "TileOccupancy",
        key: "0xdeea",
        value: {
          game_id: 1,
          entity_id: "800",
          col: 5,
          row: 35,
          alt: false,
          category: TileOccupier.DeepSite,
          is_structure: true,
        },
      },
      {
        model: "TileOccupancy",
        key: "0xdeeb",
        value: {
          game_id: 1,
          entity_id: "801",
          col: 6,
          row: 35,
          alt: false,
          category: TileOccupier.DeepSite,
          is_structure: true,
        },
      },
      {
        model: "DeepSite",
        key: "0xdee4",
        value: { game_id: 1, entity_id: 800, kind: nativeRuleConstants.DEEP_CORE, ring: 0, day: 0, aspect: 1 },
      },
      {
        model: "DeepSite",
        key: "0xdee5",
        value: { game_id: 1, entity_id: 801, kind: nativeRuleConstants.DEEP_MINE, ring: 0, day: 0, aspect: 1 },
      },
    ] as never);

    expect(readRealmStore(store, row, rules, "essence", { now: 360 }).amount).toBe(100);
    expect(readRealmStore(store, row, rules, "labor", { now: 360 }).amount).toBe(4800);

    store.applyFacts([
      { model: "GarrisonSlot", key: "0xdee6", value: { game_id: 1, structure_id: 800, slot: 0, home: 7 } },
      { model: "Guard", key: "0xdee7", value: guardAt(800, 0, 2000n * precision) },
      { model: "GarrisonSlot", key: "0xdee8", value: { game_id: 1, structure_id: 801, slot: 0, home: 7 } },
      { model: "Guard", key: "0xdee9", value: guardAt(801, 0, 2000n * precision) },
    ] as never);

    expect(readRealmStore(store, row, rules, "essence", { now: 239 }).amount).toBe(100);
    expect(readRealmStore(store, row, rules, "essence", { now: 240 }).amount).toBe(400);
    expect(readRealmStore(store, row, rules, "essence", { now: 360 }).amount).toBe(700);
    expect(Math.floor((getBalance(7, ResourcesIds.Essence, 360, store, 1).balance ?? 0) / RESOURCE_PRECISION)).toBe(
      700,
    );

    const laborAtTick2 = readRealmStore(store, row, rules, "labor", { now: 240 });
    expect(laborAtTick2).toMatchObject({ amount: 5000, limit: 5000, fullIn: 0, tone: "ember" });

    store.applyFacts([
      { model: "DeepTick", key: "0xdee1", value: { game_id: 1, paid_tick: 2 } },
      {
        model: "ResourceBalance",
        key: "0xdee2",
        value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Essence, balance: String(400n * precision) },
      },
      { model: "Guard", key: "0xdee7", value: guardAt(800, 0, 1800n * precision) },
    ] as never);

    expect(readRealmStore(store, row, rules, "essence", { now: 240 }).amount).toBe(400);
    expect(readRealmStore(store, row, rules, "essence", { now: 360 }).amount).toBe(700);
    expect(readRealmStore(store, row, rules, "essence", { now: 480 }).amount).toBe(700);
  });
});
