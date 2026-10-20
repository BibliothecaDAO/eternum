import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager, getExplorerOwner, getStructureName } from "@bibliothecadao/eternum";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, type ID, StructureType } from "@bibliothecadao/types";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

interface WorldEventStructure {
  entityId: number;
  coordX: number;
  coordY: number;
  ownerAddress: string;
  ownerName: string;
  structureName: string;
  structureType: StructureType;
}

interface WorldEventArmy {
  entityId: number;
  coordX: number;
  coordY: number;
  ownerName: string;
}

interface WorldEventLocation {
  entityId: number;
  coordX: number;
  coordY: number;
  type: "army" | "structure";
}

interface WorldEventEntityReader {
  getArmy(entityId: number): WorldEventArmy | null;
  getEntityLocation(entityId: number): WorldEventLocation | null;
  getPlayerName(ownerAddress: string): string;
  getStructure(entityId: number): WorldEventStructure | null;
  getStructuresByOwner(ownerAddress: string): WorldEventStructure[];
}

export const createWorldEventEntityReader = (
  store: NativeFactStore,
  projection: WorldSpatialProjection,
  /** The one name rule's text, from the caller's reader (React's: `usePlayerNames().text`). */
  getPlayerName: (ownerAddress: string) => string,
): WorldEventEntityReader => {
  const getStructure = (entityId: number): WorldEventStructure | null => {
    const spatial = projection.getStructure(entityId);
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
    if (!spatial || !structure) return null;

    const ownerAddress = ContractAddress(structure.owner).toString();
    return {
      entityId,
      coordX: spatial.hexCoords.col,
      coordY: spatial.hexCoords.row,
      ownerAddress,
      ownerName: getPlayerName(ownerAddress),
      structureName: getStructureName(structure).name,
      structureType: structure.base.category as StructureType,
    };
  };

  const getArmy = (entityId: number): WorldEventArmy | null => {
    const spatial = projection.getArmy(entityId);
    const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: entityId });
    if (!spatial || !explorer) return null;

    const ownerAddress = getExplorerOwner(store, explorer).toString();
    return {
      entityId,
      coordX: spatial.hexCoords.col,
      coordY: spatial.hexCoords.row,
      ownerName: ownerAddress ? getPlayerName(ownerAddress) : "",
    };
  };

  const getEntityLocation = (entityId: number): WorldEventLocation | null => {
    const structure = getStructure(entityId);
    if (structure) return { ...structure, type: "structure" };

    const army = getArmy(entityId);
    return army ? { ...army, type: "army" } : null;
  };

  const getStructuresByOwner = (ownerAddress: string): WorldEventStructure[] => {
    let normalizedOwner: string;
    try {
      normalizedOwner = ContractAddress(ownerAddress).toString();
    } catch {
      return [];
    }

    return [...projection.getStructures(false), ...projection.getStructures(true)].flatMap((spatial) => {
      if (spatial.entityId === null) return [];
      const structure = getStructure(safeInteger(spatial.entityId));
      return structure?.ownerAddress === normalizedOwner ? [structure] : [];
    });
  };

  return { getArmy, getEntityLocation, getPlayerName, getStructure, getStructuresByOwner };
};
