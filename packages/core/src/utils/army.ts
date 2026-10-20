import { safeInteger } from "./safe-integer";
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
  explorer.owner === 0n
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
        entityId: safeInteger(explorer.explorer_id),
        troops,
        totalCapacity: weight ? getArmyTotalCapacityInKg(weight) : 0,
        weight: weight ? gramToKg(divideByPrecision(Number(weight.weight))) : 0,
        position,
        entity_owner_id: safeInteger(explorer.owner),
        stamina: troops.stamina.amount,
        owner,
        ownerName: owner === 0n ? "" : (playerName(owner) ?? ""),
        structure,
        explorer,
        isMine: isViewerOwner(owner, playerAddress),
        isMercenary: owner === 0n,
        isHome: home != null && isArmyAdjacentToStructure(position, home.x, home.y, home.alt),
        name: getArmyName(safeInteger(explorer.explorer_id), store),
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
  const guards = slots.flatMap((slot) => (slot.known ? [slot.known] : []));
  if (guards.length !== slots.length) return undefined;
  return guards.flatMap((guard) =>
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

/**
 * The six tiles around a structure in ring order, each open when an army can be raised onto it; a closed tile is
 * either explored and taken, or not yet explored.
 */
export const spawnRing = (
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  structure: NativeRows["Structure"],
  occupierAt: (hex: { col: number; row: number }) => number | undefined,
): { col: number; row: number; direction: Direction; open: boolean; explored: boolean }[] => {
  const home = structureMapPosition(store, structure);
  if (!home) return [];
  return getLayerNeighborHexes(home.x, home.y, home.alt).map(({ col, row, direction }) => {
    const occupier = occupierAt({ col, row });
    return { col, row, direction, open: isOpenSpawnHex(occupier), explored: occupier !== undefined };
  });
};

export const getRemainingCapacityInKg = (weight: NativeRows["ResourceWeight"]) =>
  nanogramToKg(Number(weight.capacity - weight.weight));
export const getArmyTotalCapacityInKg = (weight: NativeRows["ResourceWeight"]) => nanogramToKg(Number(weight.capacity));
