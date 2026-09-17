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
import { configManager, divideByPrecision, getAddressName, getArmyName, gramToKg, nanogramToKg, getTileAt } from "..";

export const getExplorerOwner = (store: NativeFactStore, explorer: NativeRows["ExplorerTroops"]): bigint =>
  explorer.owner === 0
    ? 0n
    : store.require("Structure", { game_id: explorer.game_id, entity_id: explorer.owner }).owner;

export const formatArmies = (
  armies: Iterable<NativeRows["ExplorerTroops"]>,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): ArmyInfo[] =>
  [...armies].map((explorer) => {
    const keys = { game_id: explorer.game_id, entity_id: explorer.explorer_id };
    const weight = store.get("ResourceWeight", keys);
    const structure = store.get("Structure", { ...keys, entity_id: explorer.owner });
    const owner = getExplorerOwner(store, explorer);
    return {
      entityId: explorer.explorer_id,
      troops: explorer.troops,
      totalCapacity: weight ? getArmyTotalCapacityInKg(weight) : 0,
      weight: weight ? gramToKg(divideByPrecision(Number(weight.weight))) : 0,
      position: explorer.coord,
      entity_owner_id: explorer.owner,
      stamina: explorer.troops.stamina.amount,
      owner,
      ownerName: getAddressName(owner, store) ?? "",
      structure,
      explorer,
      isMine: owner === playerAddress,
      isMercenary: owner === 0n,
      isHome:
        structure !== undefined &&
        isArmyAdjacentToStructure(explorer.coord, structure.base.coord_x, structure.base.coord_y, structure.base.alt),
      name: getArmyName(explorer.explorer_id, store),
      hasAdjacentStructure: hasAdjacentOwnedStructure(explorer.coord, playerAddress, store),
    };
  });

export const getArmy = (
  armyEntityId: ID,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): ArmyInfo | undefined => {
  const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: armyEntityId });
  return explorer ? formatArmies([explorer], playerAddress, store)[0] : undefined;
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some((army) => army && army.troops.count !== 0n);
};

export const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  return entityArmies.some(
    (army) => army && realmPosition && (army.position.x !== realmPosition.x || army.position.y !== realmPosition.y),
  );
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
  return Array.from({ length: structure.base.troop_max_guard_count }, (_, slot) =>
    store.get("Guard", { game_id: structure.game_id, structure_id: structure.entity_id, slot }),
  ).flatMap((guard) =>
    guard
      ? [
          {
            slot: guard.slot,
            troops: guard.troops,
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

export const hasAdjacentOwnedStructure = (
  position: { x: number; y: number; alt: boolean },
  playerAddress: ContractAddress,
  store: NativeFactStore,
) =>
  getLayerNeighborHexes(position.x, position.y, position.alt).some((hex) => {
    const tile = getTileAt(store, position.alt, hex.col, hex.row);
    if (!tile?.occupier_is_structure) return false;
    return (
      store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: tile.occupier_id })?.owner ===
      playerAddress
    );
  });

export const isArmyAdjacentToStructure = (
  armyPosition: { x: number; y: number; alt?: boolean },
  structureX: number,
  structureY: number,
  structureAlt = false,
): boolean =>
  (armyPosition.alt ?? false) === structureAlt &&
  getLayerNeighborHexes(structureX, structureY, structureAlt).some(
    (hex) => hex.col === armyPosition.x && hex.row === armyPosition.y,
  );

export const getFreeDirectionsAroundStructure = (structureEntityId: ID, store: NativeFactStore): Direction[] => {
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureEntityId });
  if (!structure) return [];
  return getLayerNeighborHexes(structure.base.coord_x, structure.base.coord_y, structure.base.alt)
    .filter((hex) => getTileAt(store, structure.base.alt, hex.col, hex.row)?.occupier_id === 0)
    .map((hex) => hex.direction);
};

export const getRemainingCapacityInKg = (weight: NativeRows["ResourceWeight"]) =>
  nanogramToKg(Number(weight.capacity - weight.weight));
export const getArmyTotalCapacityInKg = (weight: NativeRows["ResourceWeight"]) => nanogramToKg(Number(weight.capacity));
