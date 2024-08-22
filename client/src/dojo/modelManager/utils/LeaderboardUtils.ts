import { ClientComponents } from "@/dojo/createClientComponents";
import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_ON_COMPLETION,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  HyperstructureResourceMultipliers,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";

export const TOTAL_CONTRIBUTABLE_AMOUNT: number = HYPERSTRUCTURE_TOTAL_COSTS_SCALED.reduce(
  (total, { resource, amount }) => {
    return (
      total +
      (HyperstructureResourceMultipliers[resource as keyof typeof HyperstructureResourceMultipliers] ?? 0) * amount
    );
  },
  0,
);

function getResourceMultiplier(resourceType: ResourcesIds): number {
  return HyperstructureResourceMultipliers[resourceType] ?? 0;
}

export function computeInitialContributionPoints(
  resourceType: ResourcesIds,
  resourceQuantity: bigint,
  totalPoints: number,
): number {
  return getTotalPointsPercentage(resourceType, resourceQuantity) * totalPoints;
}

export function getTotalPointsPercentage(resourceType: ResourcesIds, resourceQuantity: bigint): number {
  const effectiveContribution =
    Number(resourceQuantity / BigInt(EternumGlobalConfig.resources.resourcePrecision)) *
    getResourceMultiplier(resourceType);
  return effectiveContribution / TOTAL_CONTRIBUTABLE_AMOUNT;
}

export const calculateCompletionPoints = (
  contributions: ComponentValue<ClientComponents["Contribution"]["schema"]>[],
) => {
  return contributions.reduce((acc, contribution) => {
    return (
      acc +
      computeInitialContributionPoints(
        contribution.resource_type,
        contribution.amount,
        HYPERSTRUCTURE_POINTS_ON_COMPLETION,
      )
    );
  }, 0);
};
