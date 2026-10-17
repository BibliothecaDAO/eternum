import { buildingOutputPerSecond } from "@/ui/shared/lib/building-output";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, ResourcesIds } from "@bibliothecadao/types";

const PER_MINUTE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

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
    const perMinute = buildingOutputPerSecond(store, structure, building, null) * 60;
    return `+${PER_MINUTE.format(perMinute)} ${ResourcesIds[resource]} / min`;
  }
  return capacityGrant > 0 ? `+${capacityGrant.toLocaleString()} population cap` : null;
};

/** A building's cost, one resource at a time, as a newcomer reads it: "10 Labor (you have 1,574)". */
export const describeCostLine = (resource: ResourcesIds, amount: number, held: number | undefined): string =>
  `${amount.toLocaleString()} ${ResourcesIds[resource]}${held === undefined ? "" : ` (you have ${Math.floor(held).toLocaleString()})`}`;
