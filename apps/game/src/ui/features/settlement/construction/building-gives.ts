import { buildingOutputPerSecond } from "@/ui/shared/lib/building-output";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  BuildingType,
  getProducedResource,
  ResourcesIds,
  formatExact,
  formatRate,
  resourceName,
  formatCharge,
} from "@bibliothecadao/types";

/**
 * What one more building gives its realm, named and per unit of time: "+360 Wheat / min" for a producer (from the one
 * output source), "+6 population cap" for a hut; null for a building that gives neither.
 */
export const describeBuildingGives = (
  store: Pick<NativeFactStore, "require">,
  structure: Pick<NativeRows["Structure"], "game_id" | "base">,
  building: BuildingType,
  capacityGrant: number,
): string | null => {
  const resource = getProducedResource(building);
  if (resource !== undefined) {
    return `${resourceName(resource)} ${formatRate(buildingOutputPerSecond(store, structure, building, null))}`;
  }
  return capacityGrant > 0 ? `+${formatExact(capacityGrant)} population cap` : null;
};

/** A building's cost, one resource at a time, as a newcomer reads it: "10 Labor (you have 1,574)". */
export const describeCostLine = (resource: ResourcesIds, amount: number, held: number | undefined): string =>
  `${formatCharge(amount)} ${resourceName(resource)}${held === undefined ? "" : ` (you have ${formatExact(Math.floor(held))})`}`;
