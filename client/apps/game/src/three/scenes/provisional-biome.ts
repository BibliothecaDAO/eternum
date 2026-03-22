/**
 * Tracks tiles that were provisionally set by army spawn logic
 * so that updateExploredHex always overwrites them with real data.
 */

interface ProvisionalBiomeTracker {
  mark(col: number, row: number): void;
  clear(col: number, row: number): void;
  isProvisional(col: number, row: number): boolean;
}

export function createProvisionalBiomeTracker(): ProvisionalBiomeTracker {
  const provisional = new Set<string>();
  const key = (col: number, row: number) => `${col},${row}`;

  return {
    mark: (col, row) => provisional.add(key(col, row)),
    clear: (col, row) => provisional.delete(key(col, row)),
    isProvisional: (col, row) => provisional.has(key(col, row)),
  };
}

type ArmySpawnBiomeResult<TBiome extends string = string> =
  | { action: "skip" }
  | { action: "write_provisional"; biome: TBiome };

export function resolveArmySpawnBiome<TBiome extends string>(
  exploredTiles: Map<number, Map<number, TBiome>>,
  col: number,
  row: number,
  fallbackBiome: TBiome,
): ArmySpawnBiomeResult<TBiome> {
  const existing = exploredTiles.get(col)?.get(row);
  if (existing !== undefined) {
    return { action: "skip" };
  }
  return { action: "write_provisional", biome: fallbackBiome };
}
