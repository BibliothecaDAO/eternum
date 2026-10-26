import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";

/** What one building of a producing type adds, in whole units a second: its base, and its total with its research. */
export type BuildingOutput = { base: number; total: number };

/**
 * What one building of a producing type adds to its structure's production: the one source of a building's output for
 * every screen that shows it, its base beside its total so a screen can say what research adds (player, 25 October: the
 * boosted figure read as the base). Two contract paths:
 * - `makes` null, the construction path (Blitz, Eternum; construction.cairo's change_building_production): the
 *   produced resource's realm or village rate, with nothing added.
 * - `makes` a count, the realm board path (Frontier; buildings.cairo's board_output): the base rate (the workshop rate
 *   for Labor) plus a share of it for each Fields, Tools or Drill pick.
 */
export const buildingOutput = (
  store: Pick<NativeFactStore, "require">,
  structure: Pick<NativeRows["Structure"], "game_id" | "base">,
  category: BuildingType,
  makes: number | null,
): BuildingOutput => {
  const resource = getProducedResource(category);
  if (resource === undefined) throw new Error(`Building ${category} produces nothing`);
  const gameId = structure.game_id;
  if (makes === null) {
    const rule = store.require("ResourceRule", { game_id: gameId, resource_type: resource });
    const rate = Number(Number(structure.base.category) === StructureType.Realm ? rule.realm_rate : rule.village_rate);
    return { base: rate / RESOURCE_PRECISION, total: rate / RESOURCE_PRECISION };
  }
  const board = store.require("BoardRules", { game_id: gameId });
  const rate =
    category === BuildingType.ResourceLabor
      ? board.workshop_rate
      : store.require("ResourceRule", { game_id: gameId, resource_type: resource }).realm_rate;
  const base = Number(rate) / RESOURCE_PRECISION;
  return { base, total: (base * (10_000 + makes * board.output_step_bps)) / 10_000 };
};
