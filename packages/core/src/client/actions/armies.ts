import {
  getTroopAttackRange,
  type BiomeType,
  type ContractAddress,
  type Direction,
  type HexEntityInfo,
  type ID,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";

import { ArmyActionManager } from "../../managers/army-action-manager";
import { ArmyManager } from "../../managers/army-manager";
import { configManager } from "../../managers/config-manager";
import { StructureActionManager } from "../../managers/structure-action-manager";
import { getGuardsByStructure } from "../../utils/army";
import { readExpeditionRules, structureMapPosition } from "../../utils/expeditions";
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
  /** The structure whose guards plan; its map hex, guard reach, and spawn rule are read from the store. */
  structureId: ID;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  playerAddress: ContractAddress;
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

export const findStructurePaths = (client: ActionClient, input: StructurePathsInput): ActionPaths => {
  const { store } = client.setup;
  const structure = store.require("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: input.structureId,
  });
  const home = structureMapPosition(store, structure);
  const range = guardAttackRange(store, structure);
  if (range === undefined) return new ActionPaths();
  return new StructureActionManager().findActionPaths(
    { col: home.x, row: home.y },
    input.armyHexes,
    input.exploredHexes,
    input.playerAddress,
    range,
    readExpeditionRules(store, structure.game_id) !== null,
  );
};

/** The reach of the strongest-ranged guard with troops. */
const guardAttackRange = (
  store: ActionClient["setup"]["store"],
  structure: NativeRows["Structure"],
): number | undefined => {
  const guards = getGuardsByStructure(structure, store);
  if (!guards) return undefined;
  return Math.max(
    0,
    ...guards
      .filter((guard) => Number(guard.troops.count) > 0)
      .map((guard) => getTroopAttackRange(guard.troops.category as TroopType)),
  );
};

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
  new ArmyActionManager(client.setup.store, client.setup.systemCalls, explorerId);

/** The army manager is bound to the structure the armies belong to. */
const armyManager = (client: ActionClient, structureId: ID): ArmyManager =>
  new ArmyManager(client.setup.systemCalls, structureId);
