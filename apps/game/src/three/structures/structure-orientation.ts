import type { StructureType } from "@bibliothecadao/types";
import { getStructureModelPaths, isSettlementModelPath } from "../constants/scene-constants";
import { formatStructureCosmeticTarget, getCosmeticRegistry } from "../cosmetics/registry";
import { FRONTIER_BEAST_PATHS } from "./frontier-beast";

const cameraFacingTargets = Object.entries(getStructureModelPaths())
  .filter(([, paths]) => paths.length > 0 && paths.every(isCameraFacingModel))
  .map(([type]) => formatStructureCosmeticTarget(Number(type) as StructureType));

/** Authored +Z fronts face the map camera; a skin inherits the front of the family it replaces. */
export function resolveStructureRotationY(modelPaths: readonly string[], rotationY: number): number {
  return modelPaths.some((path) => isCameraFacingModel(path) || isCameraFacingSkin(path)) ? 0 : rotationY;
}

function isCameraFacingModel(path: string): boolean {
  return isSettlementModelPath(path) || FRONTIER_BEAST_PATHS.some((beastPath) => beastPath === path);
}

function isCameraFacingSkin(path: string): boolean {
  return getCosmeticRegistry().some(
    (entry) =>
      entry.category === "structure-skin" &&
      entry.assetPaths.includes(path) &&
      entry.appliesTo.some((target) =>
        cameraFacingTargets.some((base) => target === base || target.startsWith(`${base}:`)),
      ),
  );
}
