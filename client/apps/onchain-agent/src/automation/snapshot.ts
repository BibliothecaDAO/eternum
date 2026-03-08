/**
 * Snapshot parser — converts raw SQL balance+production rows from
 * `fetchResourceBalancesAndProduction` into typed maps the planners consume.
 */
import { RESOURCE_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface RealmSnapshot {
  balances: Map<number, number>;
  buildingCounts: Map<number, number>;
  activeBuildings: Set<number>;
}

/**
 * ResourcesIds → BuildingType offset.
 * BuildingType.ResourceStone (3) = ResourcesIds.Stone (1) + 2, and so on
 * for every resource that has a corresponding building.
 */
const RESOURCE_ID_TO_BUILDING_OFFSET = 2;

function parseBalance(hex: string | null | undefined): number {
  if (!hex || hex === "0x0" || hex === "0x") return 0;
  try {
    return Number(BigInt(hex)) / RESOURCE_PRECISION;
  } catch {
    return 0;
  }
}

export function parseRealmSnapshot(row: Record<string, any> | null | undefined): RealmSnapshot {
  const balances = new Map<number, number>();
  const buildingCounts = new Map<number, number>();
  const activeBuildings = new Set<number>();

  if (!row) return { balances, buildingCounts, activeBuildings };

  for (const { column, resourceId } of RESOURCE_BALANCE_COLUMNS) {
    const amount = parseBalance(row[column]);
    if (amount > 0) {
      balances.set(resourceId, Math.floor(amount));
    }

    // Parse production building count
    const resourceName = column.replace("_BALANCE", "");
    const prodKey = `${resourceName}_PRODUCTION.building_count`;
    const count = Number(row[prodKey] ?? 0);
    const buildingType = resourceId + RESOURCE_ID_TO_BUILDING_OFFSET;
    if (count > 0) {
      buildingCounts.set(buildingType, count);
      activeBuildings.add(buildingType);
    }
  }

  return { balances, buildingCounts, activeBuildings };
}
