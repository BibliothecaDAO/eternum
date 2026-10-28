import { BiomeType, BUILDINGS_CENTER, getNeighborOffsets } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { standTheArmyAtTheEdge } from "./explore-scenario";
import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { realmScenario } from "./realm-scenario";
import { armySpent, revealedTile } from "./spire-scenario";

type Hex = { col: number; row: number };
type Answer = (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[];

/**
 * The game the click-latency steps play (/lab/game?scenario=actions): realm 7 a full Settlement with the labor to be
 * raised, its army at the edge of the land it has seen. The chain answers each command a player's click sends as the
 * contract writes its facts: Move and Explore (movement.cairo: the army on its last tile, its stamina paid, an explored
 * tile revealed), CreateBuilding (construction.cairo: the building on its plot), LevelUp and EnterDepth as the realm and
 * spire games do.
 */
export const actionsScenario = (): LabScenario => {
  const realm = realmScenario();
  standTheArmyAtTheEdge(realm.store);
  const answers: Record<string, Answer> = { Move: moveArmy, Explore: exploreTile, CreateBuilding: placeBuilding };
  return {
    ...realm,
    answer: (command, chain, now) => (answers[command.kind] ?? realm.answer)(command, chain, now),
  };
};

/** A command's span after its variant, as felts: fields and spans in ABI order. */
const spanOf = (command: LabCommand): bigint[] => command.calldata.slice(5).map((felt) => BigInt(felt));

/** Where `directions` lead from `from`, one neighbour per step. */
const walk = (from: Hex, directions: number[]): Hex =>
  directions.reduce((hex, direction) => {
    const offset = getNeighborOffsets(hex.row)[direction];
    return { col: hex.col + offset.i, row: hex.row + offset.j };
  }, from);

/** The army's occupancy moved to `to`: its old row gone, the same row on its new tile. */
const occupancyMoved = (chain: NativeFactStore, explorerId: bigint, to: Hex): LabFact[] => {
  const [key, occupancy] = [...chain.entries("TileOccupancy")].find(([, row]) => row.entity_id === explorerId)!;
  return [
    { model: "TileOccupancy", key, value: null },
    { model: "TileOccupancy", key: `0x1ad${to.col}${to.row}`, value: wire({ ...occupancy, ...to }) },
  ];
};

const staminaRules = (chain: NativeFactStore) => chain.require("SliceRules", { game_id: 1 }).troop_stamina_config;

/** Move: the army walks its path and pays travel stamina for each step. */
const moveArmy: Answer = (command, chain, now) => {
  const [explorerId, length, ...directions] = spanOf(command);
  const steps = directions.slice(0, Number(length)).map(Number);
  const from = chain.entityOccupancy(1, Number(explorerId))!;
  return [
    ...occupancyMoved(chain, explorerId, walk(from, steps)),
    armySpent(chain, explorerId, staminaRules(chain).stamina_travel_stamina_cost * steps.length, now),
  ];
};

/** Explore: the tile beyond the army revealed, the army on it, explore stamina paid. */
const exploreTile: Answer = (command, chain, now) => {
  const explorerId = BigInt(command.fields.explorer_id);
  const from = chain.entityOccupancy(1, Number(explorerId))!;
  const to = walk(from, [Number(command.fields.direction)]);
  return [
    revealedTile(`0x1ae${to.col}${to.row}`, to, BiomeType.Grassland),
    ...occupancyMoved(chain, explorerId, to),
    armySpent(chain, explorerId, staminaRules(chain).stamina_explore_stamina_cost, now),
  ];
};

/** CreateBuilding: the building on the plot its path leads to from the castle. */
const placeBuilding: Answer = (command) => {
  const [structureId, length, ...rest] = spanOf(command);
  const directions = rest.slice(0, Number(length)).map(Number);
  const category = Number(rest[Number(length)]);
  const plot = walk({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] }, directions);
  return [
    {
      model: "Building",
      key: `0x1af${plot.col}${plot.row}`,
      value: {
        game_id: 1,
        structure_id: structureId.toString(),
        inner_col: plot.col,
        inner_row: plot.row,
        category,
        paused: false,
        labor_paid: "0",
      },
    },
  ];
};
