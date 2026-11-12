import { frontierArmyRules } from "../../ui/features/frontier/army/progression-rules-fixture";
import { installLabGame } from "@/ui/features/debug/kit-lab/fixture-game";
import { SPIRE_ARMY, SPIRE_DAY_NOW, spireDay } from "@/ui/features/frontier/spire-fixture";
import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import {
  BiomeType,
  BiomeTypeToId,
  getHexesWithinRadius,
  getNeighborHexes,
  type ResourcesIds,
} from "@bibliothecadao/types";

import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { frontierPreset } from "../../../../../config/source/frontier/native";
import { LAB_GAME, LAB_GAME_ENDS_AT, type LabFact, type LabScenario, wire } from "./lab-chain";

/** A revealed tile's packed data: its biome alone. */
const tileData = (biome: BiomeType) => BigInt(BiomeTypeToId[biome]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

/** The biome each revealed tile of a lab game lies in, by its position. */
export type LabGround = (hex: { col: number; row: number }) => BiomeType;

const GRASSLAND: LabGround = () => BiomeType.Grassland;
/** Snow, bare rock and tundra in turn: the highest ground the map draws, as the playtest's snow fields rise. */
const HIGH_GROUND: LabGround = ({ col, row }) =>
  [BiomeType.Snow, BiomeType.Bare, BiomeType.Tundra][(((col + 2 * row) % 3) + 3) % 3];
/** Beach sand, where palms grow: the owner's desert realm with its palms (28 October 2026, "shadows are weird ??"). */
export const SANDS: LabGround = () => BiomeType.Beach;
/** How many hexes round the realm a lab game reveals, and how far for the land of every biome. */
const REVEALED_REACH = 4;
const BIOMES_REACH = 12;
/** Land revealed far enough round the realm for the map's wildlife to fill its cap. */
const FULL_LOAD_REACH = 24;
/** The Surface's biomes: every one the catalog names but the absence of one and the Ethereal's ground. */
const SURFACE_BIOMES = Object.values(BiomeType).filter(
  (biome) => biome !== BiomeType.None && biome !== BiomeType.Underground,
);
/** Each biome in blocks five hexes wide, four blocks to a row, so every ground meets several others at its frontiers. */
const EVERY_BIOME: LabGround = ({ col, row }) => {
  const block = (at: number) => ((Math.floor(at / 5) % 4) + 4) % 4;
  return SURFACE_BIOMES[block(col) + 4 * block(row)];
};

/**
 * The fixture's rules as Frontier plays them: hour-long day units, so a day outlasts a session; Frontier's own commands
 * and mode rules (config/source/frontier/native.ts), so the lab offers only what a Frontier game takes (an army fights a
 * site's guard, never another army or a player's holding); and wheat the only food a step burns
 * (config/source/frontier/base.ts), since the realm holds no fish.
 */
const frontierRules = (rules: NativeRows["SliceRules"]) => {
  const wired = wire(rules) as { troop_stamina_config: object };
  return {
    ...wired,
    day_unit_seconds: 3600,
    command_mask: String(frontierPreset.commandMask),
    mode_rules: frontierPreset.modeRules,
    troop_stamina_config: { ...wired.troop_stamina_config, stamina_explore_fish_cost: 0, stamina_travel_fish_cost: 0 },
  };
};

/**
 * The spire card's day (spire-fixture.ts) as a game to play: realm 7's lit spire with Ethereal I and II researched,
 * its 1,498-knight army beside it holding 100 stamina, the land around the realm revealed, on Frontier's rules. The chain answers EnterDepth as movement.cairo's enter_depth applies it: the army leaves
 * its tile for the one straight below it, one region down per depth, revealed, keeping its stamina.
 */
export const spireScenario = (ground: LabGround = GRASSLAND, reach = REVEALED_REACH): LabScenario => {
  // The HUD's whole game (its buildings, rules and recipes) on the spire's day.
  // Frontier's own regions, a hundred tiles wide (config/source/frontier/native.ts).
  const store = installLabGame(LAB_GAME.presetId, false, () => spireDay({ spacing: 100 }));
  const rules = readExpeditionRules(store, 1)!;
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const site = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), SPIRE_DAY_NOW)!;
  const tile = (key: string, col: number, row: number): LabFact =>
    revealedTile(key, { col, row }, ground({ col, row }));
  store.applyFacts([
    { model: "SliceRules", key: "0x100", value: frontierRules(store.require("SliceRules", { game_id: 1 })) },
    {
      model: "GameRegistry",
      key: "0x3",
      value: {
        ...(wire(store.require("GameRegistry", { game_id: 1 })) as object),
        end_at: String(LAB_GAME_ENDS_AT),
      },
    },
    // The camp the card fixture keeps on another region is no part of this game.
    { model: "Structure", key: "0x71", value: null },
    { model: "ExpeditionSite", key: "0x72", value: null },
    { model: "Guard", key: "0x73", value: null },
    progressionRules(),
    armyProgress(PROGRESS_KEYS.spireArmy, SPIRE_ARMY, 0),
    ...[site, ...getHexesWithinRadius(site.col, site.row, reach)]
      .filter((hex) => !store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }))
      .map((hex, index) => tile(`0x1ab7${index.toString(16)}`, hex.col, hex.row)),
  ] as never);
  return {
    store,
    startsAt: SPIRE_DAY_NOW,
    player: "0x111",
    opensOn: site,
    answer: (command, chain) => {
      if (command.kind !== "EnterDepth") return [];
      const explorerId = BigInt(command.fields.explorer_id);
      const depth = Number(command.fields.depth);
      const [occupancyKey, occupancy] = [...chain.entries("TileOccupancy")].find(
        ([, row]) => row.entity_id === explorerId,
      )!;
      const landing = { col: occupancy.col, row: occupancy.row + depth * rules.spacing };
      return [
        { model: "TileOccupancy", key: occupancyKey, value: null },
        {
          model: "TileOccupancy",
          key: `0x1abd${depth}`,
          value: wire({ ...occupancy, ...landing }),
        },
        tile(`0x1abe${depth}`, landing.col, landing.row),
      ];
    },
  };
};

/** A tile revealed in `biome`, as the chain holds it. */
export const revealedTile = (key: string, hex: { col: number; row: number }, biome: BiomeType): LabFact => ({
  model: "TileOpt",
  key,
  value: { game_id: 1, alt: false, col: hex.col, row: hex.row, data: tileData(biome).toString() },
});

/** An army's troops row once it has paid `cost` stamina at `now`, as the chain writes it. */
export const armySpent = (chain: NativeFactStore, explorerId: bigint, cost: number | bigint, now: number): LabFact => {
  const [key, army] = [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === explorerId)!;
  const stamina = army.troops.stamina as { Inline: { amount: bigint } };
  return {
    model: "ExplorerTroops",
    key,
    value: wire({
      ...army,
      troops: {
        ...army.troops,
        stamina: { Inline: { amount: stamina.Inline.amount - BigInt(cost), settled_at: now, remainder: 0 } },
      },
    }),
  };
};

/** A holding's balances once it has paid each cost, under the keys the chain holds them by. */
export const balancesPaid = (
  chain: NativeFactStore,
  entityId: bigint,
  costs: readonly { resource: ResourcesIds; amount: bigint }[],
): LabFact[] =>
  costs.map(({ resource, amount }) => {
    const [key, held] = [...chain.entries("ResourceBalance")].find(
      ([, row]) => row.entity_id === entityId && row.resource_type === resource,
    )!;
    if (held.balance < amount) throw new Error(`The lab's holding ${entityId} cannot pay ${amount} of ${resource}`);
    return { model: "ResourceBalance", key, value: wire({ ...held, balance: held.balance - amount }) };
  });

/**
 * The spire's game on high ground (/lab/game?scenario=high-ground): the same realm, army and revealed land, every
 * revealed tile snow, bare rock or tundra, so the army's lit tiles lie on ground that rises above the old flat plates,
 * and its explore targets are sunken unexplored tiles inside that ground.
 */
export const highGroundScenario = (): LabScenario => spireScenario(HIGH_GROUND);

/**
 * The spire's game on the land of every biome: the same realm and army, the land twelve hexes round it revealed in
 * blocks of each Surface biome, so the map's grounds, frontiers, water and props are judged on fixed views before and
 * after a change to their look (the board's game, lab-games.ts).
 */
export const biomesScenario = (): LabScenario => spireScenario(EVERY_BIOME, BIOMES_REACH);

/**
 * The map at its heaviest (/lab/game?scenario=full-load): the land of every biome revealed twice as far round the realm,
 * so its vegetation is at full density across many pages and its wildlife at its cap, for timing the whole load.
 */
export const fullLoadScenario = (): LabScenario => spireScenario(EVERY_BIOME, FULL_LOAD_REACH);

/** A tile beside the one given, revealed and empty: where a lab game stands a second thing by the spire's army. */
export const besideOnOpenLand = (store: NativeFactStore, beside: { col: number; row: number }) => {
  const taken = new Set([...store.entries("TileOccupancy")].map(([, row]) => `${row.col},${row.row}`));
  const open = getNeighborHexes(beside.col, beside.row).find(
    (hex) =>
      !taken.has(`${hex.col},${hex.row}`) &&
      store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }),
  );
  if (!open) throw new Error("The lab finds no open tile beside the spire's army");
  return { col: open.col, row: open.row };
};

/** Where the spire's game keeps its progression rows: a lab game that writes its own replaces them in place. */
export const PROGRESS_KEYS = { rules: "0x1ab94", spireArmy: "0x1ab92" } as const;

/** The game's progression rules, from the Frontier preset. */
export const progressionRules = (): LabFact => ({
  model: "ArmyProgressionRules",
  key: PROGRESS_KEYS.rules,
  value: frontierArmyRules(),
});

/** The lab army's XP and trained sides, with no unspent skill points. */
export const armyProgress = (key: string, explorerId: number, xp: number): LabFact => ({
  model: "ArmyProgress",
  key,
  value: {
    game_id: 1,
    explorer_id: String(explorerId),
    xp,
    common_points: 0,
    uncommon_points: 0,
    rare_points: 0,
    epic_points: 0,
    legendary_points: 0,
    battle: 1,
    logistics: 1,
    scouting: 0,
    scouting_kinds: 0,
    homecoming: 1,
  },
});
