/**
 * Snapshot parser — converts raw SQL balance+production rows into typed maps.
 *
 * Returns both raw on-chain balances (safe for spending/budget) and projected
 * balances (includes unharvested production — useful for prioritisation).
 */
import { RESOURCE_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface RealmSnapshot {
  /** Raw on-chain balances — safe for spending decisions and budget caps. */
  balances: Map<number, number>;
  /** Projected balances including unharvested production — use for prioritisation only. */
  projectedBalances: Map<number, number>;
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

function parseRawHex(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (typeof value === "string") {
    if (value === "0x0" || value === "0x" || value === "") return 0n;
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

const FOOD_RESOURCE_IDS = new Set([35, 36]); // Wheat, Fish

export function parseRealmSnapshot(
  row: Record<string, any> | null | undefined,
  currentTimestamp?: number,
): RealmSnapshot {
  const balances = new Map<number, number>();
  const projectedBalances = new Map<number, number>();
  const buildingCounts = new Map<number, number>();
  const activeBuildings = new Set<number>();

  if (!row) return { balances, projectedBalances, buildingCounts, activeBuildings };

  for (const { column, resourceId } of RESOURCE_BALANCE_COLUMNS) {
    const amount = parseBalance(row[column]);
    const resourceName = column.replace("_BALANCE", "");

    // Raw balance — safe for spending
    if (amount > 0) {
      balances.set(resourceId, Math.floor(amount));
    }

    // Projected balance — includes unharvested production
    let projectedAmount = amount;

    if (currentTimestamp !== undefined && currentTimestamp > 0) {
      const productionRate = parseRawHex(row[`${resourceName}_PRODUCTION.production_rate`]);
      const outputAmountLeft = parseRawHex(row[`${resourceName}_PRODUCTION.output_amount_left`]);
      const lastUpdatedAt = Number(row[`${resourceName}_PRODUCTION.last_updated_at`] ?? 0);
      const buildingCount = Number(row[`${resourceName}_PRODUCTION.building_count`] ?? 0);

      if (buildingCount > 0 && productionRate > 0n && lastUpdatedAt > 0) {
        const elapsed = Math.max(0, currentTimestamp - lastUpdatedAt);
        let produced = BigInt(elapsed) * productionRate;

        if (!FOOD_RESOURCE_IDS.has(resourceId) && produced > outputAmountLeft) {
          produced = outputAmountLeft;
        }

        const producedHuman = Number(produced) / RESOURCE_PRECISION;
        projectedAmount = amount + producedHuman;
      }
    }

    if (projectedAmount > 0) {
      projectedBalances.set(resourceId, Math.floor(projectedAmount));
    }

    // Parse production building count
    const prodKey = `${resourceName}_PRODUCTION.building_count`;
    const count = Number(row[prodKey] ?? 0);
    const buildingType = resourceId + RESOURCE_ID_TO_BUILDING_OFFSET;
    if (count > 0) {
      buildingCounts.set(buildingType, count);
      activeBuildings.add(buildingType);
    }
  }

  return { balances, projectedBalances, buildingCounts, activeBuildings };
}
