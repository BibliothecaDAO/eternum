import { BiomeType, StructureType, TileOccupier } from "@bibliothecadao/types";
import type { SiteKind } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  nativeFactModels,
  nativeRuleConstants,
  type NativeModelName,
} from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
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
  const noDice =
    preset.rules.mode_rules & ~(nativeRuleConstants.COMBAT_DICE | nativeRuleConstants.COMBAT_DICE_ETHEREAL);
  store.applyFacts([
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
      initial_guard_count: String(1_100n * PRECISION),
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
            troops: troops(1_100n, 0n),
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

/** Another player's 300-knight army (explorer 301) on a tile of the fixture's day. */
export const otherArmyAt = (store: ReturnType<typeof campBeside>["store"], col: number, row: number) => {
  const mine = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
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
  return store.require("ExplorerTroops", { game_id: 1, explorer_id: 301 });
};
