import {
  BUILDINGS_CENTER,
  BuildingType,
  getHexesWithinRadius,
  getNeighborHexes,
  TileOccupier,
  StructureType,
} from "@bibliothecadao/types";
import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

const GUARD_PRECISION = 1_000_000_000n;

/** A built Kingdom and its nearby sites, using the game's own board, map and placement controls. */
export const paintedBuildingsScenario = (): LabScenario => {
  const game = spireScenario();
  const types = [
    BuildingType.ResourceWheat,
    BuildingType.ResourceLabor,
    BuildingType.ResourceKnightT1,
    BuildingType.WorkersHut,
    BuildingType.WarHall,
    BuildingType.SupplyYard,
    BuildingType.ScoutsLodge,
    BuildingType.Hearth,
  ];
  const plots = getHexesWithinRadius(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 2).filter(
    ({ col, row }) => col !== BUILDINGS_CENTER[0] || row !== BUILDINGS_CENTER[1],
  );
  const realm = game.store.require("Structure", { game_id: 1, entity_id: 7 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));
  const neighbors = getNeighborHexes(game.opensOn.col, game.opensOn.row);
  const facts: LabFact[] = [
    {
      model: "TileOccupancy",
      key: "0x1ab69",
      value: {
        game_id: 1,
        alt: false,
        col: neighbors[4].col,
        row: neighbors[4].row,
        entity_id: 710,
        category: TileOccupier.Ruin,
        is_structure: true,
      },
    },
    {
      model: "Building",
      key: "0x1ab89",
      value: {
        game_id: 1,
        structure_id: "7",
        inner_col: BUILDINGS_CENTER[0],
        inner_row: BUILDINGS_CENTER[1],
        category: BuildingType.ResourceLabor,
        paused: false,
        labor_paid: "0",
      },
    },
    {
      model: "Structure",
      key: "0x1ab67",
      value: wire({
        ...realm,
        entity_id: 710,
        owner: "0x0",
        base: { ...realm.base, category: StructureType.Ruin, level: 0 },
      }),
    },
    {
      model: "ExpeditionSite",
      key: "0x1ab68",
      value: {
        game_id: 1,
        entity_id: 710,
        category: StructureType.Ruin,
        initial_guard_count: "0",
        alt: false,
        col: neighbors[4].col,
        row: neighbors[4].row,
        clear: null,
      },
    },
    { model: "Structure", key: "0x7", value: wire({ ...realm, base: { ...realm.base, level: 2 } }) },
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: {
        game_id: 1,
        structure_id: 7,
        learned: String((2n << 46n) | 2n | (2n << 7n) | (2n << 14n) | (2n << 21n)),
      },
    },
    ...types.map((category, index) => ({
      model: "Building",
      key: `0x1ab8${index}`,
      value: {
        game_id: 1,
        structure_id: "7",
        inner_col: plots[index].col,
        inner_row: plots[index].row,
        category,
        paused: false,
        labor_paid: "0",
      },
    })),
    ...[TileOccupier.Shrine, TileOccupier.Well].map((category, index) => ({
      model: "TileOccupancy",
      key: `0x1ab6${index}`,
      value: {
        game_id: 1,
        alt: false,
        col: neighbors[index + 2].col,
        row: neighbors[index + 2].row,
        entity_id: 901 + index,
        category,
        is_structure: false,
      },
    })),
  ];
  const occupied = new Set([...game.store.rows("TileOccupancy")].map((tile) => `${tile.col},${tile.row}`));
  const sitePlots = getHexesWithinRadius(game.opensOn.col, game.opensOn.row, 2).filter(
    ({ col, row }) =>
      !occupied.has(`${col},${row}`) && !neighbors.some((neighbor) => neighbor.col === col && neighbor.row === row),
  );
  // Frontier's sites as its contracts make them: nobody's, guarded, each with its expedition site. A weak camp the army
  // beats, a strong one it does not, and a rift.
  const army = [...game.store.rows("ExplorerTroops")][0];
  for (const [index, { category, guard }] of [
    { category: StructureType.Camp, guard: 300n },
    { category: StructureType.Camp, guard: 4_000n },
    { category: StructureType.Rift, guard: 1_600n },
  ].entries()) {
    const position = sitePlots[index];
    const entityId = 711 + index;
    const count = String(guard * GUARD_PRECISION);
    facts.push(
      {
        model: "Structure",
        key: `0x1ac${index}0`,
        value: wire({
          ...realm,
          entity_id: entityId,
          owner: "0x0",
          base: { ...realm.base, category, level: 0, troop_max_guard_count: 1 },
        }),
      },
      {
        model: "TileOccupancy",
        key: `0x1ac${index}1`,
        value: {
          game_id: 1,
          alt: false,
          col: position.col,
          row: position.row,
          entity_id: entityId,
          category: category === StructureType.Camp ? TileOccupier.Camp : TileOccupier.Rift,
          is_structure: true,
        },
      },
      {
        model: "ExpeditionSite",
        key: `0x1ac${index}2`,
        value: {
          game_id: 1,
          entity_id: entityId,
          category,
          initial_guard_count: count,
          alt: false,
          col: position.col,
          row: position.row,
          clear: null,
        },
      },
      {
        model: "Guard",
        key: `0x1ac${index}3`,
        value: wire({
          game_id: 1,
          structure_id: entityId,
          slot: 0,
          troops: { ...army.troops, count },
          destroyed_tick: 0,
        }),
      },
    );
  }
  game.store.applyFacts(facts as never);
  return game;
};
