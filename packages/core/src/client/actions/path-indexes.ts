import { getExplorerOwner } from "../../utils/army";
import { BiomeIdToType, type BiomeType, ContractAddress, type HexEntityInfo, type ID } from "@bibliothecadao/types";

import { configManager } from "../../managers/config-manager";
import { FELT_CENTER } from "../../utils/utils";
import type { GameClient } from "../game-client";
import type { HexIndex } from "./armies";

/** The occupancy armyPaths and structurePaths plan around, keyed the way the scenes key it: normalized col, then row. */
export interface ArmyPathIndexes {
  structureHexes: HexIndex<HexEntityInfo>;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  chestHexes: HexIndex<HexEntityInfo>;
}

type PathIndexSource = Pick<GameClient, "setup" | "projection">;

/**
 * One layer of the world spatial projection as path-planning input. Owners come from the fact store so the planner can tell
 * the viewer's own units from targets; a headless caller has no chunking, so the whole layer is indexed.
 */
export const buildArmyPathIndexes = (client: PathIndexSource, alt = false): ArmyPathIndexes => {
  const { store } = client.setup;
  const projection = client.projection;
  const structureOwner = (structureId: ID): ContractAddress =>
    ContractAddress(
      store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureId })?.owner ?? 0n,
    );
  const armyOwner = (explorerId: ID): ContractAddress => {
    const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
    return explorer ? getExplorerOwner(store, explorer) : 0n;
  };

  const structureHexes: HexIndex<HexEntityInfo> = new Map();
  for (const structure of projection.getStructures(alt)) {
    if (structure.reserved) continue;
    indexHex(structureHexes, structure.hexCoords, {
      id: structure.entityId,
      owner: structureOwner(structure.entityId),
    });
  }
  const armyHexes: HexIndex<HexEntityInfo> = new Map();
  for (const army of projection.getArmies(alt)) {
    indexHex(armyHexes, army.hexCoords, { id: army.entityId, owner: armyOwner(army.entityId) });
  }
  const exploredHexes: HexIndex<BiomeType> = new Map();
  for (const tile of projection.getTiles(alt)) indexHex(exploredHexes, tile.hexCoords, biomeTypeOf(tile.biome));
  const chestHexes: HexIndex<HexEntityInfo> = new Map();
  for (const chest of projection.getChests(alt)) {
    indexHex(chestHexes, chest.hexCoords, { id: chest.entityId, owner: ContractAddress(0n) });
  }
  return { structureHexes, armyHexes, exploredHexes, chestHexes };
};

const indexHex = <T>(index: HexIndex<T>, hex: { col: number; row: number }, value: T): void => {
  const col = hex.col - FELT_CENTER();
  const row = index.get(col) ?? new Map<number, T>();
  row.set(hex.row - FELT_CENTER(), value);
  index.set(col, row);
};

const biomeTypeOf = (biomeId: number): BiomeType => {
  const biome = BiomeIdToType[biomeId];
  if (!biome) throw new Error(`Tile carries unknown biome id ${biomeId}`);
  return biome;
};
