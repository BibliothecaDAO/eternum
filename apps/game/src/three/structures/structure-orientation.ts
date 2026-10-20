import { isSettlementModelPath } from "../constants/scene-constants";
import { FRONTIER_BEAST_PATHS } from "./frontier-beast";

/** Entrances, standards and beasts are authored toward +Z, facing the map camera's fixed azimuth at every zoom. */
export function resolveStructureRotationY(modelPaths: readonly string[], rotationY: number): number {
  return modelPaths.some(
    (path) => isSettlementModelPath(path) || FRONTIER_BEAST_PATHS.some((beastPath) => beastPath === path),
  )
    ? 0
    : rotationY;
}
