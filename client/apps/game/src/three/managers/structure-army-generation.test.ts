import { describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

vi.mock("@bibliothecadao/eternum", () => ({
  ResourceManager: {
    isActiveStatic: (resource: Record<string, any> | null | undefined, resourceId: ResourcesIds) => {
      const production = resolveProduction(resource, resourceId);
      return Boolean(
        production &&
        production.building_count > 0 &&
        production.production_rate !== 0n &&
        production.output_amount_left !== 0n,
      );
    },
    balanceAndProduction: (resource: Record<string, any>, resourceId: ResourcesIds) => ({
      balance: 0n,
      production: resolveProduction(resource, resourceId),
    }),
    calculateResourceProductionData: (
      _resourceId: ResourcesIds,
      productionInfo: { production?: { production_rate: bigint; output_amount_left: bigint; last_updated_at: number } },
      currentDefaultTick: number,
    ) => {
      const production = productionInfo.production;
      if (!production) {
        return {
          productionPerSecond: 0,
          isProducing: false,
          outputRemaining: 0,
          timeRemainingSeconds: 0,
        };
      }

      const outputRemaining = Number(
        production.output_amount_left -
          BigInt(currentDefaultTick - production.last_updated_at) * production.production_rate,
      );

      return {
        productionPerSecond: Number(production.production_rate),
        isProducing: outputRemaining > 0,
        outputRemaining,
        timeRemainingSeconds:
          production.production_rate > 0n
            ? outputRemaining / Number(production.production_rate)
            : Number.POSITIVE_INFINITY,
      };
    },
  },
}));

import { resolveActiveArmyProductionFromResource } from "./structure-army-generation";

const PRODUCTION_FIELD_BY_RESOURCE_ID: Partial<Record<ResourcesIds, string>> = {
  [ResourcesIds.Knight]: "KNIGHT_T1_PRODUCTION",
  [ResourcesIds.KnightT2]: "KNIGHT_T2_PRODUCTION",
  [ResourcesIds.KnightT3]: "KNIGHT_T3_PRODUCTION",
  [ResourcesIds.Crossbowman]: "CROSSBOWMAN_T1_PRODUCTION",
  [ResourcesIds.CrossbowmanT2]: "CROSSBOWMAN_T2_PRODUCTION",
  [ResourcesIds.CrossbowmanT3]: "CROSSBOWMAN_T3_PRODUCTION",
  [ResourcesIds.Paladin]: "PALADIN_T1_PRODUCTION",
  [ResourcesIds.PaladinT2]: "PALADIN_T2_PRODUCTION",
  [ResourcesIds.PaladinT3]: "PALADIN_T3_PRODUCTION",
};

const resolveProduction = (resource: Record<string, any> | null | undefined, resourceId: ResourcesIds) => {
  const field = PRODUCTION_FIELD_BY_RESOURCE_ID[resourceId];
  return field ? resource?.[field] : undefined;
};

const buildProduction = (
  overrides?: Partial<{
    building_count: number;
    production_rate: bigint;
    output_amount_left: bigint;
    last_updated_at: number;
  }>,
) => ({
  building_count: 0,
  production_rate: 0n,
  output_amount_left: 0n,
  last_updated_at: 0,
  ...overrides,
});

describe("resolveActiveArmyProductionFromResource", () => {
  it("ignores non-military production entries", () => {
    const resource = {
      WHEAT_BALANCE: 0n,
      WHEAT_PRODUCTION: buildProduction({
        building_count: 5,
        production_rate: 2n,
        output_amount_left: 50n,
      }),
      KNIGHT_T1_BALANCE: 0n,
      KNIGHT_T1_PRODUCTION: buildProduction({
        building_count: 2,
        production_rate: 3n,
        output_amount_left: 30n,
      }),
    } as any;

    expect(resolveActiveArmyProductionFromResource({ resource, currentDefaultTick: 1 })).toEqual([
      { resourceId: ResourcesIds.Knight, outputPerTick: 3n, buildingCount: 2 },
    ]);
  });

  it("returns only troop resources that are actively producing", () => {
    const resource = {
      KNIGHT_T1_BALANCE: 0n,
      KNIGHT_T1_PRODUCTION: buildProduction({
        building_count: 2,
        production_rate: 3n,
        output_amount_left: 30n,
      }),
      CROSSBOWMAN_T2_BALANCE: 0n,
      CROSSBOWMAN_T2_PRODUCTION: buildProduction({
        building_count: 4,
        production_rate: 1n,
        output_amount_left: 0n,
      }),
      PALADIN_T3_BALANCE: 0n,
      PALADIN_T3_PRODUCTION: buildProduction({
        building_count: 1,
        production_rate: 0n,
        output_amount_left: 10n,
      }),
    } as any;

    expect(resolveActiveArmyProductionFromResource({ resource, currentDefaultTick: 1 })).toEqual([
      { resourceId: ResourcesIds.Knight, outputPerTick: 3n, buildingCount: 2 },
    ]);
  });

  it("drops exhausted troop production when the tick advances past the remaining output", () => {
    const resource = {
      KNIGHT_T1_BALANCE: 0n,
      KNIGHT_T1_PRODUCTION: buildProduction({
        building_count: 2,
        production_rate: 10n,
        output_amount_left: 30n,
        last_updated_at: 0,
      }),
    } as any;

    expect(resolveActiveArmyProductionFromResource({ resource, currentDefaultTick: 2 })).toEqual([
      { resourceId: ResourcesIds.Knight, outputPerTick: 10n, buildingCount: 2 },
    ]);
    expect(resolveActiveArmyProductionFromResource({ resource, currentDefaultTick: 3 })).toEqual([]);
  });
});
