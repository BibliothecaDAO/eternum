import type {
  BiomeType,
  ContractAddress,
  Direction,
  HexEntityInfo,
  HexPosition,
  ID,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";

import { ArmyActionManager } from "../../managers/army-action-manager";
import { ArmyManager } from "../../managers/army-manager";
import { StructureActionManager } from "../../managers/structure-action-manager";
import { type ActionPath, ActionPaths, ActionType } from "../../utils/action-paths";
import { type ActionClient, requireSigner } from "./signer";

/** Entities keyed by normalized col, then row: the indexes a caller projects from the world spatial projection. */
export type HexIndex<T> = Map<number, Map<number, T>>;

export interface ArmyPathsInput {
  explorerId: ID;
  structureHexes: HexIndex<HexEntityInfo>;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  chestHexes: HexIndex<HexEntityInfo>;
  currentDefaultTick: number;
  currentArmiesTick: number;
  /** Whose armies count as friendly; a spectator plans with no player. */
  playerAddress: ContractAddress;
}

export interface StructurePathsInput {
  hex: HexPosition;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  playerAddress: ContractAddress;
  attackRange: number;
}

export interface MoveArmyInput {
  explorerId: ID;
  /** One of the paths armyPaths returned for this explorer. */
  path: ActionPath[];
  currentArmiesTick: number;
}

export type MoveArmyResult = Awaited<ReturnType<ArmyActionManager["moveArmy"]>>;

export interface CreateExplorerArmyInput {
  structureId: ID;
  troopType: TroopType;
  troopTier: TroopTier;
  troopCount: number;
  spawnDirection: Direction;
}

/** The troops must match the explorer's own type and tier, so only the count and the way home are inputs. */
export interface AddTroopsToExplorerInput {
  structureId: ID;
  explorerId: ID;
  troopCount: number;
  homeDirection: Direction;
}

export interface AddTroopsToGuardInput {
  structureId: ID;
  troopType: TroopType;
  troopTier: TroopTier;
  troopCount: number;
  slot: number;
}

export interface DeleteExplorerArmyInput {
  structureId: ID;
  explorerId: ID;
}

export const findArmyPaths = (client: ActionClient, input: ArmyPathsInput): ActionPaths =>
  armyActionManager(client, input.explorerId).findActionPaths(
    input.structureHexes,
    input.armyHexes,
    input.exploredHexes,
    input.chestHexes,
    input.currentDefaultTick,
    input.currentArmiesTick,
    input.playerAddress,
  );

export const findStructurePaths = (input: StructurePathsInput): ActionPaths =>
  new StructureActionManager().findActionPaths(
    input.hex,
    input.armyHexes,
    input.exploredHexes,
    input.playerAddress,
    input.attackRange,
  );

/** A Move path travels over explored tiles; any other path reveals its destination. Spire travel is routed by the manager. */
export const moveArmy = async (client: ActionClient, input: MoveArmyInput): Promise<MoveArmyResult> =>
  armyActionManager(client, input.explorerId).moveArmy(
    requireSigner(client),
    input.path,
    ActionPaths.getActionType(input.path) === ActionType.Move,
    input.currentArmiesTick,
  );

export const createExplorerArmy = async (client: ActionClient, input: CreateExplorerArmyInput): Promise<void> =>
  armyManager(client, input.structureId).createExplorerArmy(
    requireSigner(client),
    input.troopType,
    input.troopTier,
    input.troopCount,
    input.spawnDirection,
  );

export const addTroopsToExplorer = async (client: ActionClient, input: AddTroopsToExplorerInput): Promise<void> =>
  armyManager(client, input.structureId).addTroopsToExplorer(
    requireSigner(client),
    input.explorerId,
    input.troopCount,
    input.homeDirection,
  );

export const addTroopsToGuard = async (client: ActionClient, input: AddTroopsToGuardInput): Promise<void> =>
  armyManager(client, input.structureId).addTroopsToGuard(
    requireSigner(client),
    input.troopType,
    input.troopTier,
    input.troopCount,
    input.slot,
  );

export const deleteExplorerArmy = async (client: ActionClient, input: DeleteExplorerArmyInput): Promise<void> =>
  armyManager(client, input.structureId).deleteExplorerArmy(requireSigner(client), input.explorerId);

const armyActionManager = (client: ActionClient, explorerId: ID): ArmyActionManager =>
  new ArmyActionManager(client.setup.components, client.setup.systemCalls, explorerId);

/** The army manager is bound to the structure the armies belong to. */
const armyManager = (client: ActionClient, structureId: ID): ArmyManager =>
  new ArmyManager(client.setup.systemCalls, structureId);
