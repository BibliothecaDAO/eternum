import { BuildingType } from "@bibliothecadao/types";

type BuildingRow = { structure_id: number; category: number };
const T3_BUILDINGS = new Map<number, string>([
  [BuildingType.ResourceKnightT3, "Barracks"],
  [BuildingType.ResourceCrossbowmanT3, "Archery Range"],
  [BuildingType.ResourcePaladinT3, "Stables"],
]);

/** A milestone belongs to the structure, never to an army deployed from it. */
export function createBuildingMilestones(snapshot: readonly BuildingRow[]) {
  const seen = new Set(snapshot.filter((row) => T3_BUILDINGS.has(row.category)).map((row) => row.structure_id));
  return (row: BuildingRow | undefined, isLive: boolean): string | null => {
    if (!row || !T3_BUILDINGS.has(row.category) || seen.has(row.structure_id)) return null;
    seen.add(row.structure_id);
    return isLive ? T3_BUILDINGS.get(row.category)! : null;
  };
}
