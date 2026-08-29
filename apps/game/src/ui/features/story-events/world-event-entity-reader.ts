import { gameEntityKey } from "@/sync/game-scope";
import { getAddressName, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { type ClientComponents, ContractAddress, type ID, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";

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
  components: ClientComponents,
  projection: WorldSpatialProjection,
): WorldEventEntityReader => {
  const getPlayerName = (ownerAddress: string): string => {
    try {
      return getAddressName(ContractAddress(ownerAddress), components) ?? "";
    } catch {
      return "";
    }
  };

  const getStructure = (entityId: number): WorldEventStructure | null => {
    const spatial = projection.getStructure(entityId);
    const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(entityId)]));
    if (!spatial || !structure) return null;

    const ownerAddress = ContractAddress(structure.owner).toString();
    return {
      entityId,
      coordX: spatial.hexCoords.col,
      coordY: spatial.hexCoords.row,
      ownerAddress,
      ownerName: getPlayerName(ownerAddress),
      structureName: getStructureName(structure, getIsBlitz()).name,
      structureType: structure.category as StructureType,
    };
  };

  const getArmy = (entityId: number): WorldEventArmy | null => {
    const spatial = projection.getArmy(entityId);
    const explorer = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
    if (!spatial || !explorer) return null;

    const ownerStructure = getComponentValue(components.Structure, gameEntityKey([BigInt(explorer.owner)]));
    const ownerAddress = ownerStructure?.owner ? ContractAddress(ownerStructure.owner).toString() : "";
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

    return projection.getStructures().flatMap((spatial) => {
      if (spatial.entityId === null) return [];
      const structure = getStructure(Number(spatial.entityId));
      return structure?.ownerAddress === normalizedOwner ? [structure] : [];
    });
  };

  return { getArmy, getEntityLocation, getPlayerName, getStructure, getStructuresByOwner };
};
