import { inlineTroops, resolveExplorerTroops } from "../managers/troop-stamina";
import { entityMapPosition } from "./tile";
import { structureMapPosition } from "./expeditions";
import {
  type ArmyInfo,
  type ContractAddress,
  type Direction,
  getLayerNeighborHexes,
  type ID,
  ResourcesIds,
  TickIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager, divideByPrecision, getArmyName, gramToKg, nanogramToKg, getTileAt } from "..";
import type { PlayerNameResolver } from "./entities";
import { isViewerOwner } from "./viewer";

export const getExplorerOwner = (store: NativeFactStore, explorer: NativeRows["ExplorerTroops"]): bigint =>
  explorer.owner === 0
    ? 0n
    : store.require("Structure", { game_id: explorer.game_id, entity_id: explorer.owner }).owner;

export const formatArmies = (
  armies: Iterable<NativeRows["ExplorerTroops"]>,
  playerAddress: ContractAddress | null,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): ArmyInfo[] =>
  [...armies].flatMap((explorer) => {
    const troops = resolveExplorerTroops(store, explorer);
    if (!troops) return [];
    const keys = { game_id: explorer.game_id, entity_id: explorer.explorer_id };
    const weight = store.get("ResourceWeight", keys);
    const structure = store.get("Structure", { ...keys, entity_id: explorer.owner });
    const home = structure && structureMapPosition(store, structure);
    const owner = getExplorerOwner(store, explorer);
    const position = entityMapPosition(store, explorer.game_id, explorer.explorer_id);
    return [
      {
        entityId: explorer.explorer_id,
        troops,
        totalCapacity: weight ? getArmyTotalCapacityInKg(weight) : 0,
        weight: weight ? gramToKg(divideByPrecision(Number(weight.weight))) : 0,
        position,
        entity_owner_id: explorer.owner,
        stamina: troops.stamina.amount,
        owner,
        ownerName: owner === 0n ? "" : (playerName(owner) ?? ""),
        structure,
        explorer,
        isMine: isViewerOwner(owner, playerAddress),
        isMercenary: owner === 0n,
        isHome: home !== undefined && isArmyAdjacentToStructure(position, home.x, home.y, home.alt),
        name: getArmyName(explorer.explorer_id, store),
        hasAdjacentStructure: hasAdjacentOwnedStructure(position, playerAddress, store),
      },
    ];
  });

export const getArmy = (
  armyEntityId: ID,
  playerAddress: ContractAddress,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): ArmyInfo | undefined => {
  const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: armyEntityId });
  return explorer ? formatArmies([explorer], playerAddress, store, playerName)[0] : undefined;
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some((army) => army && army.troops.count !== 0n);
};

export const getTroopName = (troopType: TroopType, troopTier: TroopTier): string => {
  switch (troopTier) {
    case TroopTier.T1:
      switch (troopType) {
        case TroopType.Knight:
          return "Footman";
        case TroopType.Crossbowman:
          return "Archer";
        case TroopType.Paladin:
          return "Horseman";
      }
    case TroopTier.T2:
      switch (troopType) {
        case TroopType.Knight:
          return "Knight";
        case TroopType.Crossbowman:
          return "Crossbowman";
        case TroopType.Paladin:
          return "Paladin";
      }
    case TroopTier.T3:
      switch (troopType) {
        case TroopType.Knight:
          return "Royal Guardian";
        case TroopType.Crossbowman:
          return "Beast Hunter";
        case TroopType.Paladin:
          return "Dragon Rider";
      }
  }
};

export const getTroopResourceId = (troopType: TroopType, troopTier: TroopTier): ResourcesIds => {
  switch (troopType) {
    case TroopType.Knight:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Knight;
        case TroopTier.T2:
          return ResourcesIds.KnightT2;
        case TroopTier.T3:
          return ResourcesIds.KnightT3;
      }
    case TroopType.Crossbowman:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Crossbowman;
        case TroopTier.T2:
          return ResourcesIds.CrossbowmanT2;
        case TroopTier.T3:
          return ResourcesIds.CrossbowmanT3;
      }
    case TroopType.Paladin:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Paladin;
        case TroopTier.T2:
          return ResourcesIds.PaladinT2;
        case TroopTier.T3:
          return ResourcesIds.PaladinT3;
      }
  }
};

export const getGuardsByStructure = (structure: NativeRows["Structure"], store: NativeFactStore) => {
  const delay = configManager.getTroopConfig().troop_limit_config.guard_resurrection_delay;
  const tickSeconds = configManager.getTick(TickIds.Armies);
  const slots = Array.from({ length: structure.base.troop_max_guard_count }, (_, slot) =>
    store.requireOrAbsent("Guard", { game_id: structure.game_id, structure_id: structure.entity_id, slot }),
  );
  if (slots.some((slot) => !slot.known)) return undefined;
  return slots
    .map((slot) => slot.known!)
    .flatMap((guard) =>
      guard.troops.count !== 0n || guard.destroyed_tick !== 0
        ? [
            {
              slot: guard.slot,
              troops: inlineTroops(guard.troops, store.require("SliceRules", { game_id: structure.game_id })),
              destroyedTick: guard.destroyed_tick,
              cooldownEnd: guard.destroyed_tick === 0 ? 0 : guard.destroyed_tick * tickSeconds + delay,
            },
          ]
        : [],
    );
};

/** Seconds before a wiped guard slot accepts troops again; 0 when it is open. The contract only enforces the
 *  resurrection delay on an empty slot, so a slot that still holds troops never reads as cooling down. */
export const getGuardSlotCooldownRemaining = (
  guard: { troops: { count: bigint | number }; cooldownEnd: number },
  currentBlockTimestamp: number,
): number => (Number(guard.troops.count) > 0 ? 0 : Math.max(0, guard.cooldownEnd - currentBlockTimestamp));

const hasAdjacentOwnedStructure = (
  position: { x: number; y: number; alt: boolean },
  playerAddress: ContractAddress | null,
  store: NativeFactStore,
) =>
  getLayerNeighborHexes(position.x, position.y, position.alt).some((hex) => {
    const tile = getTileAt(store, position.alt, hex.col, hex.row);
    if (!tile?.occupier_is_structure) return false;
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: tile.occupier_id });
    return isViewerOwner(structure?.owner, playerAddress);
  });

const isArmyAdjacentToStructure = (
  armyPosition: { x: number; y: number; alt?: boolean },
  structureX: number,
  structureY: number,
  structureAlt = false,
): boolean =>
  (armyPosition.alt ?? false) === structureAlt &&
  getLayerNeighborHexes(structureX, structureY, structureAlt).some(
    (hex) => hex.col === armyPosition.x && hex.row === armyPosition.y,
  );

/** Deployment requires an explored, unoccupied tile; unknown terrain disables the action. */
export const isOpenSpawnHex = (occupierId: number | undefined): boolean => occupierId === 0;

/** The directions an army can be raised in from a structure, given the occupier of each explored neighbour. */
export const openSpawnDirections = (
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  structure: NativeRows["Structure"],
  occupierAt: (hex: { col: number; row: number }) => number | undefined,
): Direction[] => {
  const home = structureMapPosition(store, structure);
  return getLayerNeighborHexes(home.x, home.y, home.alt)
    .filter((hex) => isOpenSpawnHex(occupierAt(hex)))
    .map((hex) => hex.direction);
};

export const getRemainingCapacityInKg = (weight: NativeRows["ResourceWeight"]) =>
  nanogramToKg(Number(weight.capacity - weight.weight));
export const getArmyTotalCapacityInKg = (weight: NativeRows["ResourceWeight"]) => nanogramToKg(Number(weight.capacity));
