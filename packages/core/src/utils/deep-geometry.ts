import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { surfaceNeighborAtDistance } from "./travel";

export function deepCenter(spacing: number): { col: number; row: number } {
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

export function deepGate(spacing: number, gateDistance: number, aspect: number): { col: number; row: number } {
  if (aspect < 1 || aspect > 4) throw new Error(`No gate for Aspect ${aspect}`);
  const center = deepCenter(spacing);
  const { x, y } = compassPoint({ x: center.col, y: center.row }, aspect - 1, gateDistance);
  return { col: x, row: y };
}

const compassPoint = (origin: { x: number; y: number }, point: number, distance: number) => {
  if (point === 0) return zigzag(origin, 1, 2, distance);
  if (point === 1) return surfaceNeighborAtDistance(origin, 0, distance);
  if (point === 2) return zigzag(origin, 4, 5, distance);
  return surfaceNeighborAtDistance(origin, 3, distance);
};

const zigzag = (origin: { x: number; y: number }, first: number, second: number, distance: number) =>
  surfaceNeighborAtDistance(
    surfaceNeighborAtDistance(origin, first, Math.ceil(distance / 2)),
    second,
    Math.floor(distance / 2),
  );
