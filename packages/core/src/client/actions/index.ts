import type { ActionPaths } from "../../utils/action-paths";
import type { GameClient } from "../game-client";
import {
  addTroopsToExplorer,
  type AddTroopsToExplorerInput,
  addTroopsToGuard,
  type AddTroopsToGuardInput,
  type ArmyPathsInput,
  createExplorerArmy,
  type CreateExplorerArmyInput,
  deleteExplorerArmy,
  type DeleteExplorerArmyInput,
  findArmyPaths,
  findStructurePaths,
  moveArmy,
  type MoveArmyInput,
  type MoveArmyResult,
  type StructurePathsInput,
} from "./armies";
import {
  type BuildingSlotInput,
  destroyBuilding,
  pauseProduction,
  placeBuilding,
  type PlaceBuildingInput,
  type PlaceBuildingResult,
  resumeProduction,
} from "./buildings";

export * from "./armies";
export * from "./buildings";

/**
 * The orchestration the scenes and panels used to write inline: bind the manager, plan, submit. Each action returns
 * what its manager returns, so a caller awaits the same thing it did before; the UI half (selection, FX, toasts,
 * pending indicators) stays with the caller.
 */
export interface GameActions {
  /** Every move, explore, attack, help, chest, and spire option open to an explorer from its RECS position. */
  armyPaths(input: ArmyPathsInput): ActionPaths;
  /** The support and attack options a structure's guards have over the armies around it. */
  structurePaths(input: StructurePathsInput): ActionPaths;
  moveArmy(input: MoveArmyInput): Promise<MoveArmyResult>;
  createExplorerArmy(input: CreateExplorerArmyInput): Promise<void>;
  addTroopsToExplorer(input: AddTroopsToExplorerInput): Promise<void>;
  addTroopsToGuard(input: AddTroopsToGuardInput): Promise<void>;
  deleteExplorerArmy(input: DeleteExplorerArmyInput): Promise<void>;
  placeBuilding(input: PlaceBuildingInput): Promise<PlaceBuildingResult>;
  destroyBuilding(input: BuildingSlotInput): Promise<void>;
  pauseProduction(input: BuildingSlotInput): Promise<void>;
  resumeProduction(input: BuildingSlotInput): Promise<void>;
}

/** Submits sign with client.signer, so connect(signer) must precede any action that writes. */
export const createGameActions = (client: GameClient): GameActions => ({
  armyPaths: (input) => findArmyPaths(client, input),
  structurePaths: (input) => findStructurePaths(input),
  moveArmy: (input) => moveArmy(client, input),
  createExplorerArmy: (input) => createExplorerArmy(client, input),
  addTroopsToExplorer: (input) => addTroopsToExplorer(client, input),
  addTroopsToGuard: (input) => addTroopsToGuard(client, input),
  deleteExplorerArmy: (input) => deleteExplorerArmy(client, input),
  placeBuilding: (input) => placeBuilding(client, input),
  destroyBuilding: (input) => destroyBuilding(client, input),
  pauseProduction: (input) => pauseProduction(client, input),
  resumeProduction: (input) => resumeProduction(client, input),
});
