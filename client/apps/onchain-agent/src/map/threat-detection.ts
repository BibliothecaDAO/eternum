import { getNeighborHexes } from "@bibliothecadao/types";
import { isExplorer } from "../world/occupier.js";

export interface ThreatAlert {
  enemyX: number;
  enemyY: number;
  enemyEntityId: number;
  structureX: number;
  structureY: number;
  structureEntityId: number;
}

interface TileInput {
  x: number;
  y: number;
  occupierId: number;
  occupierType: number;
  isOwned?: boolean;
}

export function detectThreats(
  ownedStructures: TileInput[],
  allTiles: TileInput[],
  recentAlerts: Set<string>,
): ThreatAlert[] {
  const tileIndex = new Map<string, TileInput>();
  for (const t of allTiles) {
    tileIndex.set(`${t.x},${t.y}`, t);
  }

  const alerts: ThreatAlert[] = [];

  for (const structure of ownedStructures) {
    const neighbors = getNeighborHexes(structure.x, structure.y);
    for (const n of neighbors) {
      const key = `${n.col},${n.row}`;
      if (recentAlerts.has(key)) continue;

      const tile = tileIndex.get(key);
      if (!tile) continue;
      if (tile.occupierId <= 0) continue;
      if (tile.isOwned) continue;
      if (!isExplorer(tile.occupierType)) continue;

      alerts.push({
        enemyX: tile.x,
        enemyY: tile.y,
        enemyEntityId: tile.occupierId,
        structureX: structure.x,
        structureY: structure.y,
        structureEntityId: structure.occupierId,
      });
    }
  }

  return alerts;
}
