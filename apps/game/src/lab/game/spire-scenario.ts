import { installLabGame } from "@/ui/features/debug/kit-lab/fixture-game";
import { SPIRE_DAY_NOW, spireDay } from "@/ui/features/frontier/spire-fixture";
import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId, getHexesWithinRadius } from "@bibliothecadao/types";

import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../../contracts/l3/world-native/schema/commands.gen";
import { LAB_GAME, LAB_GAME_ENDS_AT, type LabFact, type LabScenario } from "./lab-chain";

const GRASS = BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * The fixture's rules as Frontier plays them where the spire needs it: hour-long day units, so a day outlasts a
 * session; depth entry enabled (config/source/frontier/native.ts); and wheat the only food a step burns
 * (config/source/frontier/base.ts), since the realm holds no fish.
 */
const frontierRules = (rules: NativeRows["SliceRules"]) => {
  const wired = wire(rules) as { troop_stamina_config: object };
  return {
    ...wired,
    day_unit_seconds: 3600,
    command_mask: String(rules.command_mask | BigInt(nativeCommandBits.EnterDepth)),
    troop_stamina_config: { ...wired.troop_stamina_config, stamina_explore_fish_cost: 0, stamina_travel_fish_cost: 0 },
  };
};

/**
 * The spire card's day (spire-fixture.ts) as a game to play: realm 7's lit spire with Ethereal I and II researched,
 * its 1,498-knight army beside it holding 100 stamina, the land around the realm revealed, on Frontier's rules. The chain answers EnterDepth as movement.cairo's enter_depth applies it: the army leaves
 * its tile for the one straight below it, one region down per depth, revealed, and pays the depth's entry stamina.
 */
export const spireScenario = (): LabScenario => {
  // The HUD's whole game (its buildings, rules and recipes) on the spire's day.
  // Frontier's own regions, a hundred tiles wide (config/source/frontier/native.ts).
  const store = installLabGame(LAB_GAME.presetId, false, () => spireDay({ spacing: 100 }));
  const rules = readExpeditionRules(store, 1)!;
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const site = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), SPIRE_DAY_NOW)!;
  const tile = (key: string, col: number, row: number): LabFact => ({
    model: "TileOpt",
    key,
    value: { game_id: 1, alt: false, col, row, data: GRASS.toString() },
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
    { model: "GameRelease", key: "0x1ab0", value: { game_id: 1, release_id: 1, preset_commitment: "0x1ab" } },
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
