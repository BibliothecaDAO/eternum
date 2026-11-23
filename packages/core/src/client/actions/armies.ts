import {
  TileOccupier,
  type BiomeType,
  type ContractAddress,
  type Direction,
  type HexEntityInfo,
  type ID,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import { ArmyActionManager, type ArmyReach } from "../../managers/army-action-manager";
import { ArmyManager } from "../../managers/army-manager";
import { configManager } from "../../managers/config-manager";
import { StructureActionManager } from "../../managers/structure-action-manager";
import { getGuardsByStructure } from "../../utils/army";
import { structureMapPosition } from "../../utils/expeditions";
import { getTileAt } from "../../utils/tile";
import { type ActionPath, ActionPaths, ActionType } from "../../utils/action-paths";
import { type ActionClient, requireSigner } from "./signer";

/** Entities keyed by normalized col, then row: the indexes a caller projects from the world spatial projection. */
export type HexIndex<T> = Map<number, Map<number, T>>;

export interface ArmyPathsInput {
  explorerId: ID;
  structureHexes: HexIndex<HexEntityInfo>;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  currentDefaultTick: number;
  /** Whose armies count as friendly; a spectator plans with no player. */
  playerAddress: ContractAddress;
}

interface ArmyReachInput {
  explorerId: ID;
  currentDefaultTick: number;
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
}

export type MoveArmyResult = Awaited<ReturnType<ArmyActionManager["moveArmy"]>>;
export type CreateExplorerArmyResult = Awaited<ReturnType<ArmyManager["createExplorerArmy"]>>;

export interface CreateExplorerArmyInput {
  slot: number;
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
  supplyPost?: number;
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
    input.currentDefaultTick,
    input.playerAddress,
  );

/** What bounds an explorer's orders at this tick: armyPaths offers the same orders while it and the map hold. */
export const findArmyReach = (client: ActionClient, input: ArmyReachInput): ArmyReach =>
  armyActionManager(client, input.explorerId).reach(input.currentDefaultTick);

export const findStructurePaths = (client: ActionClient, input: StructurePathsInput): ActionPaths => {
  const { store } = client.setup;
  const structure = store.require("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: input.structureId,
  });
  const home = structureMapPosition(store, structure);
  const guards = getGuardsByStructure(structure, store);
  if (!home || !guards) return new ActionPaths();
  return new StructureActionManager().findActionPaths(
    { col: home.x, row: home.y },
    input.armyHexes,
    input.exploredHexes,
    input.playerAddress,
    (hex) => (getTileAt(store, home.alt, hex.col, hex.row)?.occupier_type ?? TileOccupier.None) !== TileOccupier.None,
    guards.some((guard) => Number(guard.troops.count) > 0),
  );
};

/** A Move path travels over explored tiles; any other path reveals its destination. Spire travel is routed by the manager. */
export const moveArmy = async (client: ActionClient, input: MoveArmyInput): Promise<MoveArmyResult> =>
  armyActionManager(client, input.explorerId).moveArmy(
    requireSigner(client),
    input.path,
    ActionPaths.getActionType(input.path) === ActionType.Move,
  );

export const createExplorerArmy = async (
  client: ActionClient,
  input: CreateExplorerArmyInput,
): Promise<CreateExplorerArmyResult> =>
  armyManager(client, input.structureId).createExplorerArmy(
    requireSigner(client),
    input.troopType,
    input.troopTier,
    input.troopCount,
    input.spawnDirection,
    input.slot,
  );

export const addTroopsToExplorer = async (client: ActionClient, input: AddTroopsToExplorerInput): Promise<void> =>
  armyManager(client, input.structureId).addTroopsToExplorer(
    requireSigner(client),
    input.explorerId,
    input.troopCount,
    input.supplyPost,
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
