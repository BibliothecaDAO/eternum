import type { AccountInterface } from "starknet";

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
import { actingAs } from "./signer";

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

interface CreateGameActionsOptions {
  /**
   * Sign with this account instead of the client's connected signer. One client holds the game once; a process that
   * plays many players over it (the lab harness's bots) gets one facade per account, with no shared signer to race on.
   */
  signer?: AccountInterface;
}

/** Submits sign with client.signer, so connect(signer) must precede any action that writes, unless a signer is named. */
export const createGameActions = (client: GameClient, options: CreateGameActionsOptions = {}): GameActions => {
  const actor = options.signer ? actingAs(client, options.signer) : client;
  return {
    armyPaths: (input) => findArmyPaths(actor, input),
    structurePaths: (input) => findStructurePaths(input),
    moveArmy: (input) => moveArmy(actor, input),
    createExplorerArmy: (input) => createExplorerArmy(actor, input),
    addTroopsToExplorer: (input) => addTroopsToExplorer(actor, input),
    addTroopsToGuard: (input) => addTroopsToGuard(actor, input),
    deleteExplorerArmy: (input) => deleteExplorerArmy(actor, input),
    placeBuilding: (input) => placeBuilding(actor, input),
    destroyBuilding: (input) => destroyBuilding(actor, input),
    pauseProduction: (input) => pauseProduction(actor, input),
    resumeProduction: (input) => resumeProduction(actor, input),
  };
};
