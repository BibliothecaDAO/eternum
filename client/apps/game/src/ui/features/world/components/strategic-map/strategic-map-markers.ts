import {
  getExplorerInfoFromTileOccupier,
  getStructureInfoFromTileOccupier,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { StructureType, TileOccupier } from "@bibliothecadao/types";

import type { MinimapTile } from "./strategic-map-coordinates";
import { normalizeEntityId } from "./strategic-map-coordinates";

export type StrategicMarkerKind = "army" | "realm" | "settlement" | "landmark" | "resource" | "quest" | "chest";
export type StrategicMarkerDisposition = "friendly" | "hostile" | "neutral";

export interface TileMarker {
  iconSrc: string;
  kind: StrategicMarkerKind;
  disposition: StrategicMarkerDisposition;
  sizeMultiplier?: number;
}

const LABEL_ICONS = {
  armyMine: "/images/labels/army.png",
  armyEnemy: "/images/labels/enemy_army.png",
  realmMine: "/images/labels/realm.png",
  realmEnemy: "/images/labels/enemy_realm.png",
  villageMine: "/images/labels/village.png",
  villageEnemy: "/images/labels/enemy_village.png",
  hyperstructure: "/images/labels/hyperstructure.png",
  fragmentMine: "/images/labels/fragment_mine.png",
  quest: "/images/labels/quest.png",
  chest: "/images/labels/chest.png",
} as const;

export function getOccupierColor(tile: MinimapTile): string | null {
  if (!tile.occupier_id) return null;
  const occupierType = tile.occupier_type ?? 0;
  if (occupierType === TileOccupier.Spire) return "#67e8f9";
  const hasStructure = tile.occupier_is_structure || isTileOccupierStructure(occupierType);
  return hasStructure ? "#22d3ee" : "#f97316";
}

export function resolveStrategicMapTileMarker(input: {
  tile: MinimapTile;
  ownedStructureIds: Set<string>;
  ownedExplorerIds: Set<string>;
  fragmentMineIconSrc: string;
}): TileMarker | null {
  const occupierType = input.tile.occupier_type ?? 0;

  if (occupierType === TileOccupier.Chest) {
    return {
      iconSrc: LABEL_ICONS.chest,
      kind: "chest",
      disposition: "neutral",
      sizeMultiplier: 0.82,
    };
  }

  if (occupierType === TileOccupier.Quest) {
    return {
      iconSrc: LABEL_ICONS.quest,
      kind: "quest",
      disposition: "neutral",
      sizeMultiplier: 0.86,
    };
  }

  const hasStructure = input.tile.occupier_is_structure || isTileOccupierStructure(occupierType);
  if (hasStructure) {
    const structureInfo = getStructureInfoFromTileOccupier(occupierType);
    if (!structureInfo) {
      return null;
    }

    switch (structureInfo.type) {
      case StructureType.FragmentMine:
      case StructureType.BitcoinMine:
        return {
          iconSrc: input.fragmentMineIconSrc,
          kind: "resource",
          disposition: resolveStructureDisposition(input.tile.occupier_id, input.ownedStructureIds),
          sizeMultiplier: 0.92,
        };
      case StructureType.Village:
      case StructureType.Camp:
        return {
          iconSrc: input.ownedStructureIds.has(normalizeEntityId(input.tile.occupier_id) ?? "")
            ? LABEL_ICONS.villageMine
            : LABEL_ICONS.villageEnemy,
          kind: "settlement",
          disposition: resolveStructureDisposition(input.tile.occupier_id, input.ownedStructureIds),
          sizeMultiplier: 0.94,
        };
      case StructureType.Realm:
        return {
          iconSrc: input.ownedStructureIds.has(normalizeEntityId(input.tile.occupier_id) ?? "")
            ? LABEL_ICONS.realmMine
            : LABEL_ICONS.realmEnemy,
          kind: "realm",
          disposition: resolveStructureDisposition(input.tile.occupier_id, input.ownedStructureIds),
          sizeMultiplier: 1,
        };
      case StructureType.Hyperstructure:
        return {
          iconSrc: LABEL_ICONS.hyperstructure,
          kind: "landmark",
          disposition: "neutral",
          sizeMultiplier: 1.1,
        };
      default:
        return null;
    }
  }

  const explorerInfo = getExplorerInfoFromTileOccupier(occupierType);
  if (!explorerInfo) {
    return null;
  }

  const occupierId = normalizeEntityId(input.tile.occupier_id);
  return {
    iconSrc: occupierId && input.ownedExplorerIds.has(occupierId) ? LABEL_ICONS.armyMine : LABEL_ICONS.armyEnemy,
    kind: "army",
    disposition: occupierId && input.ownedExplorerIds.has(occupierId) ? "friendly" : "hostile",
    sizeMultiplier: 0.9,
  };
}

function resolveStructureDisposition(
  occupierId: string | undefined,
  ownedStructureIds: Set<string>,
): StrategicMarkerDisposition {
  const normalizedEntityId = normalizeEntityId(occupierId);
  return normalizedEntityId && ownedStructureIds.has(normalizedEntityId) ? "friendly" : "hostile";
}
