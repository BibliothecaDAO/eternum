import { frontierArmyRules } from "../army/progression-rules-fixture";
import { BiomeType, BiomeTypeToId, getNeighborHexes, StructureType, TileOccupier } from "@bibliothecadao/types";
import type { SiteKind } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  nativeFactModels,
  nativeRuleConstants,
  nativeTilePackingConstants,
  type NativeModelName,
  type NativeRows,
} from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeCommandBits } from "../../../../../../../contracts/l3/world-native/schema/commands.gen";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
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
 * it, in a game without combat dice as Frontier plays.
 */
const SITE_CATEGORY: Record<SiteKind, StructureType> = {
  Camp: StructureType.Camp,
  Rift: StructureType.Rift,
  Ruin: StructureType.Ruin,
  Beasts: StructureType.Beasts,
};

export const campBeside = (kind: SiteKind = "Camp", guardKnown = true, armyStamina = 100n) => {
  const { store } = frontierDay();
  const guardCount = kind === "Beasts" ? 1000n : 1100n;
  const noDice =
    preset.rules.mode_rules & ~(nativeRuleConstants.COMBAT_DICE | nativeRuleConstants.COMBAT_DICE_ETHEREAL);
  store.applyFacts([
    set("0x901", "DepthRules", {
      game_id: 1,
      depth: 1,
      reveal_percent: 15,
      site_guard_lower: 3000,
      site_guard_upper: 5000,
      reveal_site_neighbors: false,
      chest: { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
      ruin_guard_lower: 6000,
      ruin_guard_upper: 10500,
      guard_step: 100,
      beast_weak_lower: 900,
      beast_weak_upper: 1050,
      beast_strong_lower: 1350,
      beast_strong_upper: 1650,
    }),
    set("0x101", "LordsBudget", {
      game_id: 1,
      pool: "1000000",
      pool_left: "1000000",
      open: "0",
      day: "0",
      price: "50",
      rolled_shares: "0",
      yesterday_shares: "0",
      yesterday_ticks: "0",
    }),
    set("0x100", "SliceRules", {
      ...preset.rules,
      game_id: 1,
      day_unit_seconds: 100,
      mode_rules: noDice,
      battle_config: { ...preset.rules.battle_config, cooldown_seconds: 0 },
    }),
    set("0x71", "Structure", {
      ...store.require("Structure", { game_id: 1, entity_id: 7 }),
      entity_id: SITE,
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
      entity_id: SITE,
      category: SITE_CATEGORY[kind],
      initial_guard_count: String(guardCount * PRECISION),
      ...SITE_TILE,
      clear: null,
    }),
    ...(kind === "Ruin"
      ? [set("0x76", "SiteChest", { game_id: 1, entity_id: SITE, tier: 3, amount: "500", reservation_day: "0" })]
      : []),
    ...(guardKnown
      ? [
          set("0x73", "Guard", {
            game_id: 1,
            structure_id: SITE,
            slot: 0,
            troops: troops(guardCount, 0n),
            destroyed_tick: 0,
          }),
        ]
      : []),
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
  const attack = (armyTile: SiteAttack["armyTile"]): SiteAttack => ({
    army,
    armyTile,
    biome: BiomeType.Grassland,
    timestamp: 350,
  });
  return {
    store,
    site: store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
    structure: store.require("Structure", { game_id: 1, entity_id: SITE }),
    attack,
  };
};

/**
 * Frontier's combat as deployed (config/generated/frontier.madara.json): its troop damage, its troop stamina (30 to
 * attack, 40 to defend, a bar of 120 gaining one a tick, no refund) and its two-minute army tick, over the fixture's
 * rules. Wheat and fish costs in the config are whole units; the rules hold them in the resource precision.
 */
const frontierCombatRules = () => {
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
      ...preset.rules.tick_config,
      armies_tick_in_seconds: frontierConfig.configuration.tick.armiesTickIntervalInSeconds,
    },
  };
};

/**
 * Prod's Blightglow Rift as the owner met it on 3 November 2026, on Frontier's deployed combat: the rift's guard of
 * 1,400 T1 knights holding `guardStamina` (40 or more rested; less, tired: it strikes at 70%), and the realm's army of
 * `troops` T1 knights beside it in its first army slot, at Battle 1 (+10% damage), its bar holding `armyStamina`.
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
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    set("0x100", "SliceRules", { ...wire(store.require("SliceRules", { game_id: 1 })), ...frontierCombatRules() }),
    set("0x73", "Guard", {
      game_id: 1,
      structure_id: SITE,
      slot: 0,
      troops: troops(1_400n, guardStamina),
      destroyed_tick: 0,
    }),
    set("0xf1", "ArmyProgressionRules", frontierArmyRules()),
    set("0x74", "ExplorerTroops", {
      ...wire(army),
      troops: { ...wire(army.troops), count: String(armyTroops * PRECISION), stamina: { Slot: 0 } },
    }),
    set("0xf2012", "ArmyProgress", {
      game_id: 1,
      explorer_id: 201,
      xp: 0,
      common_points: 0,
      uncommon_points: 0,
      rare_points: 0,
      epic_points: 0,
      legendary_points: 0,
      battle: 1,
      logistics: 0,
      scouting: 0,
      homecoming: 0,
      scouting_kinds: 0,
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
  const attack = (armyTile: SiteAttack["armyTile"]): SiteAttack => ({
    army: store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }),
    armyTile,
    biome: BiomeType.Grassland,
    timestamp: 350,
  });
  return { ...fixture, attack };
};

/** Another player's 300-knight army (explorer 301) on a tile of the fixture's day. */
export const otherArmyAt = (store: ReturnType<typeof campBeside>["store"], col: number, row: number) => {
  const mine = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
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

/** Where the sites fixture's army stands, and the Shrine and Well beside it; a second Shrine stands far off. */
export const ARMY_TILE = { col: 41, row: 12, alt: false };
export const SHRINE_TILE = { col: 40, row: 12, alt: false };
export const WELL_TILE = { col: 42, row: 12, alt: false };
export const FAR_SHRINE_TILE = { col: 49, row: 12, alt: false };

type SiteTile = typeof SHRINE_TILE;
/** Where each of the fixture's things stands. */
export type SitesLayout = { army: SiteTile; shrine: SiteTile; well: SiteTile; far: SiteTile };
const SITES_LAYOUT: SitesLayout = { army: ARMY_TILE, shrine: SHRINE_TILE, well: WELL_TILE, far: FAR_SHRINE_TILE };

/**
 * The deploy fixture's Frontier day, where the game allows site use as Frontier's preset does, with the realm's
 * 1,498-knight army (explorer 201) on revealed grassland: a Shrine and a Well beside it, a Shrine eight tiles off, and the
 * Shrines' discovered ranks. The army's bar holds `stamina` of its 150. `layout` places them elsewhere (the lab
 * puts them on its drawn world); the Shrine and the Well must stand beside the army.
 */
export const sitesBeside = (stamina: bigint, layout: SitesLayout = SITES_LAYOUT) => {
  const { store } = frontierDay();
  const grass = String(BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE));
  const revealed = [layout.army, ...getNeighborHexes(layout.army.col, layout.army.row), layout.far];
  const sites = [
    ["0x76", layout.shrine, 901, TileOccupier.Shrine],
    ["0x77", layout.well, 902, TileOccupier.Well],
    ["0x78", layout.far, 903, TileOccupier.Shrine],
  ] as const;
  const site = (key: string, tile: SiteTile, entity: number, category: TileOccupier) =>
    set(key, "TileOccupancy", { game_id: 1, ...tile, alt: false, entity_id: entity, category, is_structure: false });
  store.applyFacts([
    set("0x100", "SliceRules", {
      ...preset.rules,
      game_id: 1,
      day_unit_seconds: 100,
      // The deploy fixture's bar: 150 at most for each troop type.
      troop_stamina_config: {
        ...preset.rules.troop_stamina_config,
        stamina_initial: 150,
        stamina_knight_max: 150,
        stamina_paladin_max: 150,
        stamina_crossbowman_max: 150,
      },
      command_mask: String(BigInt(preset.rules.command_mask) | BigInt(nativeCommandBits.InteractSite)),
    }),
    set("0x101", "ArmyProgressionRules", frontierArmyRules()),
    ...revealed.map((tile, index) =>
      set(`0x20${index}`, "TileOpt", { game_id: 1, alt: false, col: tile.col, row: tile.row, data: grass }),
    ),
    set("0x74", "ExplorerTroops", { game_id: 1, explorer_id: 201, owner: 7, troops: troops(1_498n, stamina) }),
    site("0x75", layout.army, 201, TileOccupier.ExplorerKnightT1),
    ...sites.map(([key, tile, entity, category]) => site(key, tile, entity, category)),
    set("0xa901", "ShrineReward", { game_id: 1, entity_id: 901, rank: 3 }),
    set("0xa903", "ShrineReward", { game_id: 1, entity_id: 903, rank: 5 }),
  ] as never);
  /** The chain's answer to a use: the site's tile emptied, as the contract vacates it. */
  const vacate = (tile: { col: number; row: number }) => {
    const [key] = sites.find(([, at]) => at.col === tile.col && at.row === tile.row)!;
    store.applyFacts([{ model: "TileOccupancy", key, value: null }] as never);
  };
  return { store, vacate };
};

export const relicEffectFact = (kind: NativeRows["ArmyRelicEffect"]["kind"], rank = 1, expiresAt = 380) => ({
  model: "ArmyRelicEffect" as const,
  key: `0x${(0x9000 + nativeFactModels.ArmyRelicEffect.fields.kind.enum.indexOf(kind)).toString(16)}`,
  value: { game_id: 1, explorer_id: 201n, kind, rank, expires_at: BigInt(expiresAt) },
});
