import { BiomeType, BiomeTypeToId, getNeighborHexes, StructureType, TileOccupier } from "@bibliothecadao/types";
import type { SiteKind } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  nativeFactModels,
  nativeRuleConstants,
  nativeTilePackingConstants,
  type NativeModelName,
} from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeCommandBits } from "../../../../../../../contracts/l3/world-native/schema/commands.gen";
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

/** Where the sites fixture's army stands, and the Shrine and Well beside it; a second Shrine stands far off. */
export const ARMY_TILE = { col: 41, row: 12, alt: false };
export const SHRINE_TILE = { col: 40, row: 12, alt: false };
export const WELL_TILE = { col: 42, row: 12, alt: false };
export const FAR_SHRINE_TILE = { col: 49, row: 12, alt: false };

/**
 * The deploy fixture's Frontier day, where the game allows site use as Frontier's preset does, with the realm's
 * 1,498-knight army (explorer 201) on revealed grassland: a Shrine and a Well beside it, a Shrine eight tiles off, and the
 * game's XP rules (200 XP a Shrine). The army's bar holds `stamina` of its 150.
 */
export const sitesBeside = (stamina: bigint) => {
  const { store } = frontierDay();
  const grass = String(BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE));
  const revealed = [ARMY_TILE, ...getNeighborHexes(ARMY_TILE.col, ARMY_TILE.row), FAR_SHRINE_TILE];
  const site = (key: string, tile: typeof SHRINE_TILE, entity: number, category: TileOccupier) =>
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
    set("0x101", "ArmyProgressionRules", {
      game_id: 1,
      reveal_xp: 2,
      fixed_xp: 200,
      uncommon_xp: 100,
      rare_xp: 200,
      epic_xp: 400,
      legendary_xp: 800,
    }),
    ...revealed.map((tile, index) =>
      set(`0x20${index}`, "TileOpt", { game_id: 1, alt: false, col: tile.col, row: tile.row, data: grass }),
    ),
    set("0x74", "ExplorerTroops", { game_id: 1, explorer_id: 201, owner: 7, troops: troops(1_498n, stamina) }),
    site("0x75", ARMY_TILE, 201, TileOccupier.ExplorerKnightT1),
    ...SITES.map(([key, tile, entity, category]) => site(key, tile, entity, category)),
  ] as never);
  /** The chain's answer to a use: the site's tile emptied, as the contract vacates it. */
  const vacate = (tile: { col: number; row: number }) => {
    const [key] = SITES.find(([, at]) => at.col === tile.col && at.row === tile.row)!;
    store.applyFacts([{ model: "TileOccupancy", key, value: null }] as never);
  };
  return { store, vacate };
};

const SITES = [
  ["0x76", SHRINE_TILE, 901, TileOccupier.Shrine],
  ["0x77", WELL_TILE, 902, TileOccupier.Well],
  ["0x78", FAR_SHRINE_TILE, 903, TileOccupier.Shrine],
] as const;
