import { BiomeType, BiomeTypeToId, StructureType, TileOccupier } from "@bibliothecadao/types";
import type { SiteKind } from "@bibliothecadao/eternum";
import { NativeFactStore, nativeResearchConstants } from "@bibliothecadao/eternum/game-client";
import {
  nativeFactModels,
  nativeTilePackingConstants,
  type NativeModelName,
  type NativeRows,
} from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";

import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import frontierConfig from "../../../../../../../config/generated/frontier.madara.json";
import { frontierDay } from "../deploy/deploy-fixture";
import type { SiteAttack } from "./site-card-plan";

const PRECISION = 1_000_000_000n;
export const SITE = 710;
export const SITE_TILE = { col: 40, row: 12, alt: false };
const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const troops = (count: bigint, stamina: bigint) => ({
  ...rowFixture.expected.value.troops,
  count: String(count * PRECISION),
  stamina: { Inline: { amount: String(stamina), settled_at: "360", remainder: 0 } },
});

/** Reload only surviving wire facts into a fresh store, without any prior entity state. */
export const reloadSiteFacts = (store: NativeFactStore): NativeFactStore => {
  const snapshot = (Object.keys(nativeFactModels) as NativeModelName[]).flatMap((model) =>
    [...store.entries(model)].map(([key, value]) => ({ model, key, value })),
  );
  const restored = new NativeFactStore();
  restored.applyFacts(
    JSON.parse(JSON.stringify(snapshot, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
  );
  return restored;
};

/**
 * The deploy fixture's Frontier day with a camp guarded by 1,100 T1 knights on row 12 and the realm's 1,498-knight army beside
 * it.
 */
const SITE_CATEGORY: Record<SiteKind, StructureType> = {
  Camp: StructureType.Camp,
  Rift: StructureType.Rift,
  Ruin: StructureType.Ruin,
  Beasts: StructureType.Beasts,
};

export const campBeside = (
  kind: SiteKind = "Camp",
  guardKnown = true,
  armyStamina = 100n,
  entityId: number | bigint = SITE,
) => {
  const { store } = frontierDay();
  const guardCount = kind === "Beasts" ? 1000n : 1100n;
  store.applyFacts([
    set("0x901", "DepthRules", {
      game_id: 1,
      depth: 1,
      reveal_percent: 15,
      site_guard_lower: 3000,
      site_guard_upper: 5000,
      rift_guard_lower: 3000,
      rift_guard_upper: 5000,
      reveal_site_neighbors: false,
      chest: { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
      guard_step: 100,
      beast_weak_lower: 900,
      beast_weak_upper: 1050,
      beast_strong_lower: 1350,
      beast_strong_upper: 1650,
    }),
    set("0x100", "SliceRules", {
      ...release.definition.rules,
      game_id: 1,
      day_unit_seconds: 100,
      mode_rules: release.definition.rules.mode_rules,
      battle_config: { ...release.definition.rules.battle_config, cooldown_seconds: 0, regular_immunity_ticks: 0 },
    }),
    set("0x71", "Structure", {
      ...store.require("Structure", { game_id: 1, entity_id: 7 }),
      entity_id: entityId,
      owner: "0x0",
      base: {
        category: SITE_CATEGORY[kind],
        level: 0,
        created_at: "0x1",
        troop_max_guard_count: 1,
        troop_max_explorer_count: 0,
        starting_troops_granted: true,
      },
    }),
    set("0x72", "ExpeditionSite", {
      game_id: 1,
      entity_id: entityId,
      category: SITE_CATEGORY[kind],
      initial_guard_count: String(guardCount * PRECISION),
      ...SITE_TILE,
      clear: null,
    }),
    ...(guardKnown
      ? [
          set("0x73", "Guard", {
            game_id: 1,
            structure_id: entityId,
            slot: 0,
            troops: { ...troops(guardCount, 0n), category: kind === "Rift" ? "Crossbowman" : "Knight" },
            destroyed_tick: 0,
          }),
        ]
      : []),
    set("0xad201", "ArmyDay", { game_id: 1, explorer_id: 201, day: 0 }),
    set("0xf2012", "ArmyProgress", {
      game_id: 1,
      explorer_id: 201,
      logistics: 0,
      oath_slots: nativeResearchConstants.OATH_SLOTS_BASE,
      oaths: 0,
      oath_pick: 0,
    }),
    set("0xf2013", "ArmyCombat", { game_id: 1, explorer_id: 201, last_target: 0 }),
    set("0x74", "ExplorerTroops", { game_id: 1, explorer_id: 201, owner: 7, troops: troops(1_498n, armyStamina) }),
    set("0x75", "TileOccupancy", {
      game_id: 1,
      alt: false,
      col: 41,
      row: 12,
      entity_id: 201,
      category: TileOccupier.ExplorerKnightT1,
      is_structure: false,
    }),
  ] as never);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const attack = (armyTile: ArmyTile): SiteAttack => {
    standArmyAt(store, armyTile);
    return { army, timestamp: 350 };
  };
  return {
    store,
    site: store.require("ExpeditionSite", { game_id: 1, entity_id: entityId }),
    structure: store.require("Structure", { game_id: 1, entity_id: entityId }),
    attack,
  };
};

/**
 * Frontier's combat as deployed (config/generated/frontier.madara.json): its troop damage, its troop stamina (30 to
 * attack, 40 to defend, a bar of 120 gaining one a tick, no refund) and its two-minute army tick, over the fixture's
 * rules. Wheat and fish costs in the config are whole units; the rules hold them in the resource precision.
 */
export const frontierCombatRules = () => {
  const { damage, stamina } = frontierConfig.configuration.troop;
  const units = (amount: number) => String(Math.round(amount * Number(PRECISION)));
  return {
    troop_damage_config: {
      damage_biome_bonus_num: damage.damageBiomeBonusNum,
      damage_scaling_factor: damage.damageScalingFactor,
      t1_damage_value: damage.t1DamageValue,
      t2_damage_multiplier: damage.t2DamageMultiplier,
      t3_damage_multiplier: damage.t3DamageMultiplier,
    },
    troop_stamina_config: {
      damage_stamina_refund: stamina.damageStaminaRefund,
      capture_stamina_refund: stamina.captureStaminaRefund,
      stamina_gain_per_tick: stamina.staminaGainPerTick,
      stamina_initial: stamina.staminaInitial,
      stamina_bonus_value: stamina.staminaBonusValue,
      stamina_knight_max: stamina.staminaKnightMax,
      stamina_paladin_max: stamina.staminaPaladinMax,
      stamina_crossbowman_max: stamina.staminaCrossbowmanMax,
      stamina_attack_req: stamina.staminaAttackReq,
      stamina_defense_req: stamina.staminaDefenseReq,
      stamina_explore_stamina_cost: stamina.staminaExploreStaminaCost,
      stamina_travel_stamina_cost: stamina.staminaTravelStaminaCost,
      stamina_explore_wheat_cost: units(stamina.staminaExploreWheatCost),
      stamina_explore_fish_cost: units(stamina.staminaExploreFishCost),
      stamina_travel_wheat_cost: units(stamina.staminaTravelWheatCost),
      stamina_travel_fish_cost: units(stamina.staminaTravelFishCost),
    },
    tick_config: {
      ...release.definition.rules.tick_config,
      armies_tick_in_seconds: frontierConfig.configuration.tick.armiesTickIntervalInSeconds,
    },
  };
};

/**
 * Blightglow's recorded troop counts, played under the current Frontier rules: its bow guard holds
 * `guardStamina`, and the realm's Knights hold `armyStamina` in their shared slot.
 */
export const blightglowRift = ({
  troops: armyTroops,
  guardStamina,
  armyStamina,
}: {
  troops: bigint;
  guardStamina: bigint;
  armyStamina: bigint;
}) => {
  const fixture = campBeside("Rift");
  const { store } = fixture;
  placeSite(store);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    set("0x100", "SliceRules", { ...wire(store.require("SliceRules", { game_id: 1 })), ...frontierCombatRules() }),
    set("0x73", "Guard", {
      game_id: 1,
      structure_id: SITE,
      slot: 0,
      troops: { ...troops(1_400n, guardStamina), category: "Crossbowman" },
      destroyed_tick: 0,
    }),
    set("0x74", "ExplorerTroops", {
      ...wire(army),
      troops: { ...wire(army.troops), count: String(armyTroops * PRECISION), stamina: { Slot: 0 } },
    }),
    set("0x9", "ArmySlot", {
      game_id: 1,
      structure_id: 7,
      epoch: "0",
      slot: 0,
      explorer_id: 201,
      stamina: { amount: String(armyStamina), settled_at: "350", remainder: 0 },
    }),
  ] as never);
  const attack = (armyTile: ArmyTile): SiteAttack => {
    standArmyAt(store, armyTile);
    return { army: store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }), timestamp: 350 };
  };
  return { ...fixture, attack };
};

type ArmyTile = { col: number; row: number; alt: boolean };

const standArmyAt = (store: NativeFactStore, tile: ArmyTile) => {
  const standing = store.entityOccupancy(1, 201);
  if (standing && standing.col === tile.col && standing.row === tile.row && standing.alt === tile.alt) return;
  const seat = { game_id: 1, ...tile, entity_id: 201, category: TileOccupier.ExplorerKnightT1, is_structure: false };
  store.applyFacts([
    ...(standing ? [{ model: "TileOccupancy", key: store.wireKeyOf("TileOccupancy", standing)!, value: null }] : []),
    set(`0x75${tile.col.toString(16)}${tile.row.toString(16)}`, "TileOccupancy", seat),
  ] as never);
};

export const placeSite = (store: NativeFactStore, entityId: number | bigint = SITE) =>
  store.applyFacts([
    set("0x7101", "TileOccupancy", {
      game_id: 1,
      ...SITE_TILE,
      entity_id: entityId,
      category: TileOccupier.Camp,
      is_structure: true,
    }),
    set("0x7201", "TileOpt", {
      game_id: 1,
      ...SITE_TILE,
      data: String(BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE)),
    }),
  ] as never);

/** Another player's 300-knight army (explorer 301) on a tile of the fixture's day. */
export const otherArmyAt = (store: ReturnType<typeof campBeside>["store"], col: number, row: number) => {
  const mine = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    set("0xad301", "ArmyDay", { game_id: 1, explorer_id: 301, day: 0 }),
    set("0xaf301", "ArmyProgress", { ...store.require("ArmyProgress", mine), explorer_id: 301n }),
    {
      model: "Structure",
      key: "0x92",
      value: wire({
        ...store.require("Structure", { game_id: 1, entity_id: mine.owner }),
        entity_id: 9,
        owner: "0x999",
      }),
    },
    {
      model: "ExplorerTroops",
      key: "0x90",
      value: wire({ ...mine, explorer_id: 301, owner: 9, troops: { ...mine.troops, count: 300n * PRECISION } }),
    },
    {
      model: "TileOccupancy",
      key: "0x91",
      value: { game_id: 1, alt: false, col, row, entity_id: 301, category: 15, is_structure: false },
    },
  ] as never);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", visit: "0x999", timestamp: 350 });
  return store.require("ExplorerTroops", { game_id: 1, explorer_id: 301 });
};

export const relicEffectFact = (kind: NativeRows["ArmyRelicEffect"]["kind"], rank = 1, expiresAt = 380) => ({
  model: "ArmyRelicEffect" as const,
  key: `0x${(0x9000 + nativeFactModels.ArmyRelicEffect.fields.kind.enum.indexOf(kind)).toString(16)}`,
  value: { game_id: 1, explorer_id: 201n, kind, rank, expires_at: BigInt(expiresAt) },
});
