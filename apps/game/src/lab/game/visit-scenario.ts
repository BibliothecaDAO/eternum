import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { BUILDINGS_CENTER, BuildingType, getHexesWithinRadius } from "@bibliothecadao/types";

import type { LabFact, LabScenario } from "./lab-chain";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";
import { castlePriced } from "./realm-scenario";

/** The neighbour whose realm the player visits, and the realm. */
const NEIGHBOUR = "0x222";
const NEIGHBOUR_REALM = 8;

/**
 * Each of the neighbour's plots holds another building than the player's same plot does (painted-buildings-scenario's
 * eight, turned by five): the Barracks stands where the player's Supply yard does, so a card read off the wrong realm
 * names the wrong building.
 */
const NEIGHBOUR_BUILDINGS = [
  BuildingType.SupplyYard,
  BuildingType.ScoutsLodge,
  BuildingType.Hearth,
  BuildingType.ResourceWheat,
  BuildingType.ResourceLabor,
  BuildingType.ResourceKnightT1,
  BuildingType.WorkersHut,
  BuildingType.WarHall,
];

/**
 * The painted Kingdom's game with a neighbour's Kingdom on the season board (/lab/game?scenario=visit): the board's
 * Visit opens it, the player's own realm one press away. Their plots are built in another order and the outer ring
 * stands open on both, so the visit shows whether its cards, plots, strip and panel read the realm on the board.
 */
export const visitScenario = (): LabScenario => {
  const game = paintedBuildingsScenario();
  const realm = game.store.require("Structure", { game_id: 1, entity_id: 7 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));
  const plots = getHexesWithinRadius(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 2).filter(
    ({ col, row }) => col !== BUILDINGS_CENTER[0] || row !== BUILDINGS_CENTER[1],
  );
  const facts: LabFact[] = [
    ...castlePriced(),
    {
      model: "Structure",
      key: "0x1ad0",
      // Its own Realm, so its name tells it from the player's on the strip and the panel.
      value: wire({
        ...realm,
        entity_id: NEIGHBOUR_REALM,
        owner: NEIGHBOUR,
        metadata: { ...realm.metadata, realm_id: realm.metadata.realm_id + 1 },
      }),
    },
    {
      model: "StructureBuildings",
      key: "0x1ad1",
      value: {
        game_id: 1,
        entity_id: String(NEIGHBOUR_REALM),
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current: 4, max: 6 },
      },
    },
    // What the realm has researched, which its strip and panel read as a visit streams them.
    {
      model: "RealmKnowledge",
      key: "0x1ad4",
      value: wire({
        ...game.store.require("RealmKnowledge", { game_id: 1, structure_id: 7 }),
        structure_id: NEIGHBOUR_REALM,
      }),
    },
    // The castle stands on the centre plot, as the player's does (painted-buildings-scenario).
    {
      model: "Building",
      key: "0x1ad3",
      value: {
        game_id: 1,
        structure_id: String(NEIGHBOUR_REALM),
        inner_col: BUILDINGS_CENTER[0],
        inner_row: BUILDINGS_CENTER[1],
        category: BuildingType.ResourceLabor,
        paused: false,
        labor_paid: "0",
      },
    },
    ...NEIGHBOUR_BUILDINGS.map((category, index) => ({
      model: "Building",
      key: `0x1ad2${index}`,
      value: {
        game_id: 1,
        structure_id: String(NEIGHBOUR_REALM),
        inner_col: plots[index].col,
        inner_row: plots[index].row,
        category,
        paused: false,
        labor_paid: "0",
      },
    })),
  ];
  game.store.applyFacts(facts as never);
  return {
    ...game,
    board: [boardEntry(game.player, 7, 1), boardEntry(NEIGHBOUR, NEIGHBOUR_REALM, 2)],
  };
};

const boardEntry = (address: string, structureId: number, rank: number): HeraldFrontierLeaderboardEntry => ({
  address,
  structure_id: String(structureId),
  rank,
  sites_cleared: { total: 0, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
  chests_earned: 0,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 0,
  level: 2,
  order: 1,
});
