import { isRealmOrVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { StructureType } from "@bibliothecadao/types";

// Settlement entrances are authored toward +Z: south, facing the fixed gameplay camera.
export function resolveSettlementRotationY(category: StructureType | undefined, rotationY: number): number {
  return isRealmOrVillageLikeStructureCategory(category) ? 0 : rotationY;
}
