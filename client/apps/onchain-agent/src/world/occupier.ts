/**
 * Occupier type classification for hex tiles.
 *
 * Occupier type IDs are assigned by the on-chain world contract:
 *   - 1–14:  Structures (cities, mines, etc.)
 *   - 15–32: Explorers (player-controlled armies)
 *   - 34:    Chest (loot drop)
 *
 * A value of 0 means the tile is unoccupied.
 */

/**
 * Return true if the occupier type represents a structure.
 * Structures occupy type IDs 1 through 14 (inclusive).
 *
 * @param occupierType - Numeric occupier type ID from the tile state.
 * @returns True if the tile is occupied by a structure.
 */
export function isStructure(occupierType: number): boolean {
  return occupierType >= 1 && occupierType <= 14;
}

/**
 * Return true if the occupier type represents an explorer (army).
 * Explorers occupy type IDs 15 through 32 (inclusive).
 *
 * @param occupierType - Numeric occupier type ID from the tile state.
 * @returns True if the tile is occupied by an explorer.
 */
export function isExplorer(occupierType: number): boolean {
  return occupierType >= 15 && occupierType <= 32;
}

/**
 * Return true if the occupier type represents a chest (loot drop).
 * Chests have the fixed type ID 34.
 *
 * @param occupierType - Numeric occupier type ID from the tile state.
 * @returns True if the tile is occupied by a chest.
 */
export function isChest(occupierType: number): boolean {
  return occupierType === 34;
}
