import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

function deepCenter(spacing: number): { col: number; row: number } {
  if (spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) throw new Error("Deep needs a full expedition region");
  return { col: Math.floor(spacing / 2), row: spacing * 3 + Math.floor(spacing / 2) };
}

export function isDeepTile(spacing: number, tile: { col: number; row: number; alt: boolean }): boolean {
  if (tile.alt || spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) return false;
  const center = deepCenter(spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  return (
    tile.col >= center.col - half &&
    tile.col < center.col + half &&
    tile.row >= center.row - half &&
    tile.row < center.row + half
  );
}
