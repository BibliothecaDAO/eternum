import { isRealmOrVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { StructureType } from "@bibliothecadao/types";
import type { FrontierBeast } from "@bibliothecadao/eternum";

/** Entrances and beasts are authored toward +Z, facing the map camera's fixed azimuth at every zoom. */
export function resolveStructureRotationY(
  structure: { structureType: StructureType | undefined; frontierBeast?: Pick<FrontierBeast, "beast"> },
  rotationY: number,
): number {
  return structure.frontierBeast || isRealmOrVillageLikeStructureCategory(structure.structureType) ? 0 : rotationY;
}
