/** Occupier type classification for hex tiles. */

export function isStructure(occupierType: number): boolean {
  return occupierType >= 1 && occupierType <= 14;
}

export function isExplorer(occupierType: number): boolean {
  return occupierType >= 15 && occupierType <= 32;
}

export function isChest(occupierType: number): boolean {
  return occupierType === 34;
}
