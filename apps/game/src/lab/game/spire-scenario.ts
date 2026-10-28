import { installLabGame } from "@/ui/features/debug/kit-lab/fixture-game";
import { SPIRE_DAY_NOW, spireDay } from "@/ui/features/frontier/spire-fixture";
import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId, getHexesWithinRadius, getNeighborHexes } from "@bibliothecadao/types";

import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { frontierPreset } from "../../../../../config/source/frontier/native";
import { LAB_GAME, LAB_GAME_ENDS_AT, type LabFact, type LabScenario } from "./lab-chain";

/** A revealed tile's packed data: its biome alone. */
const tileData = (biome: BiomeType) => BigInt(BiomeTypeToId[biome]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

/** The biome each revealed tile of a lab game lies in, by its position. */
type LabGround = (hex: { col: number; row: number }) => BiomeType;

const GRASSLAND: LabGround = () => BiomeType.Grassland;
/** Snow, bare rock and tundra in turn: the highest ground the map draws, as the playtest's snow fields rise. */
const HIGH_GROUND: LabGround = ({ col, row }) =>
  [BiomeType.Snow, BiomeType.Bare, BiomeType.Tundra][(((col + 2 * row) % 3) + 3) % 3];

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

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
 * its tile for the one straight below it, one region down per depth, revealed, and pays the depth's entry stamina.
 */
export const spireScenario = (ground: LabGround = GRASSLAND): LabScenario => {
  // The HUD's whole game (its buildings, rules and recipes) on the spire's day.
  // Frontier's own regions, a hundred tiles wide (config/source/frontier/native.ts).
  const store = installLabGame(LAB_GAME.presetId, false, () => spireDay({ spacing: 100 }));
  const rules = readExpeditionRules(store, 1)!;
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const site = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), SPIRE_DAY_NOW)!;
  const tile = (key: string, col: number, row: number): LabFact => ({
    model: "TileOpt",
    key,
    value: { game_id: 1, alt: false, col, row, data: tileData(ground({ col, row })).toString() },
  });
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
    ...[site, ...getHexesWithinRadius(site.col, site.row, 4)]
      .filter((hex) => !store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }))
      .map((hex, index) => tile(`0x1ab7${index.toString(16)}`, hex.col, hex.row)),
  ] as never);
  return {
    store,
    startsAt: SPIRE_DAY_NOW,
    player: "0x111",
    opensOn: site,
    answer: (command, chain, now) => {
      if (command.kind !== "EnterDepth") return [];
      const explorerId = BigInt(command.fields.explorer_id);
      const depth = Number(command.fields.depth);
      const [occupancyKey, occupancy] = [...chain.entries("TileOccupancy")].find(
        ([, row]) => row.entity_id === explorerId,
      )!;
      const landing = { col: occupancy.col, row: occupancy.row + depth * rules.spacing };
      const [armyKey, army] = [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === explorerId)!;
      const stamina = army.troops.stamina as { Inline: { amount: bigint } };
      const cost = chain.require("DepthRules", { game_id: 1, depth }).entry_stamina;
      return [
        { model: "TileOccupancy", key: occupancyKey, value: null },
        {
          model: "TileOccupancy",
          key: `0x1abd${depth}`,
          value: wire({ ...occupancy, ...landing }),
        },
        tile(`0x1abe${depth}`, landing.col, landing.row),
        {
          model: "ExplorerTroops",
          key: armyKey,
          value: wire({
            ...army,
            troops: {
              ...army.troops,
              stamina: { Inline: { amount: stamina.Inline.amount - BigInt(cost), settled_at: now, remainder: 0 } },
            },
          }),
        },
      ];
    },
  };
};

/**
 * The spire's game on high ground (/lab/game?scenario=high-ground): the same realm, army and revealed land, every
 * revealed tile snow, bare rock or tundra, so the army's lit tiles lie on ground that rises above the old flat plates,
 * and its explore targets are sunken unexplored tiles inside that ground.
 */
export const highGroundScenario = (): LabScenario => spireScenario(HIGH_GROUND);

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
