import { isVillageLikeStructureCategory, normalizeStructureCategory } from "@/lib/structure-type-utils";
import { StructureType } from "@bibliothecadao/types";

export type StructurePointRendererKey =
  | "myVillage"
  | "enemyVillage"
  | "allyVillage"
  | "myRealm"
  | "enemyRealm"
  | "allyRealm"
  | "hyperstructure"
  | "bank"
  | "fragmentMine";

interface ResolveStructurePointRendererKeyInput {
  structureType: StructureType | number | bigint | null | undefined;
  isMine: boolean;
  isAlly: boolean;
}

export function resolveStructurePointRendererKey(
  input: ResolveStructurePointRendererKeyInput,
): StructurePointRendererKey | null {
  const structureType = normalizeStructureCategory(input.structureType);
  if (structureType === null) {
    return null;
  }

  if (isVillageLikeStructureCategory(structureType)) {
    return input.isMine ? "myVillage" : input.isAlly ? "allyVillage" : "enemyVillage";
  }

  if (structureType === StructureType.Realm) {
    return input.isMine ? "myRealm" : input.isAlly ? "allyRealm" : "enemyRealm";
  }

  if (structureType === StructureType.Hyperstructure || structureType === StructureType.HolySite) {
    return "hyperstructure";
  }

  if (structureType === StructureType.Bank) {
    return "bank";
  }

  if (structureType === StructureType.FragmentMine || structureType === StructureType.BitcoinMine) {
    return "fragmentMine";
  }

  return null;
}
