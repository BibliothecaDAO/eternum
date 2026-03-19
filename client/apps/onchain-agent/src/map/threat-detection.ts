import { getNeighborHexes } from "@bibliothecadao/types";
import { isExplorer } from "../world/occupier.js";

/** An enemy explorer detected adjacent to one of the player's structures. */
export interface ThreatAlert {
  /** Hex x-coordinate of the enemy explorer. */
  enemyX: number;
  /** Hex y-coordinate of the enemy explorer. */
  enemyY: number;
  /** Entity ID of the enemy explorer. */
  enemyEntityId: number;
  /** Hex x-coordinate of the threatened structure. */
  structureX: number;
  /** Hex y-coordinate of the threatened structure. */
  structureY: number;
  /** Entity ID of the threatened structure. */
  structureEntityId: number;
}

/** Minimal tile data needed for threat scanning. */
interface TileInput {
  x: number;
  y: number;
  occupierId: number;
  occupierType: number;
  /** Whether the occupier belongs to the player. */
  isOwned?: boolean;
}

/**
 * Scan the six neighbours of every owned structure for enemy explorers.
 *
 * Tiles already present in `recentAlerts` (keyed as `"x,y"`) are skipped
 * so the same threat is not reported twice in consecutive ticks.
 *
 * @param ownedStructures - Tiles containing the player's own structures.
 * @param allTiles - Every visible tile on the current map snapshot.
 * @param recentAlerts - Coordinate keys (`"x,y"`) of threats already reported.
 * @returns New threat alerts for enemy explorers adjacent to owned structures.
 */
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
