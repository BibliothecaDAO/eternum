import { StructureType } from "@bibliothecadao/types";

type StructureCategoryLike = StructureType | number | bigint | null | undefined;

const VILLAGE_LIKE_STRUCTURE_CATEGORIES = new Set<StructureType>([StructureType.Village, StructureType.Camp]);

export const normalizeStructureCategory = (category: StructureCategoryLike): StructureType | null => {
  if (category === undefined || category === null) return null;

  const normalizedCategory = Number(category);
  return Number.isFinite(normalizedCategory) ? (normalizedCategory as StructureType) : null;
};

export const isVillageLikeStructureCategory = (category: StructureCategoryLike) => {
  const normalizedCategory = normalizeStructureCategory(category);
  return normalizedCategory !== null && VILLAGE_LIKE_STRUCTURE_CATEGORIES.has(normalizedCategory);
};

export const isRealmOrVillageLikeStructureCategory = (category: StructureCategoryLike) => {
  const normalizedCategory = normalizeStructureCategory(category);
  return normalizedCategory === StructureType.Realm || isVillageLikeStructureCategory(normalizedCategory);
};
