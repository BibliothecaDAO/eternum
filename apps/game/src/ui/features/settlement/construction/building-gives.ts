import { buildingOutputPerSecond } from "@/ui/shared/lib/building-output";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, formatExact, formatRate, resourceName } from "@bibliothecadao/types";

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
