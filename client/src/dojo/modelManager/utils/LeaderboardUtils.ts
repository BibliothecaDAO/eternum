import { ClientComponents } from "@/dojo/createClientComponents";
import {
  HYPERSTRUCTURE_POINTS_ON_COMPLETION,
  HyperstructureResourceMultipliers,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientConfigManager } from "../ClientConfigManager";
import { useMemo } from "react";

export function getTotalContributableAmount() {
  const config = ClientConfigManager.instance();
  const hyperstructureTotalCosts = config.getHyperstructureTotalCosts();

  return useMemo(
    () =>
      hyperstructureTotalCosts.reduce((total, { resource, amount }) => {
        return (
          total +
          (HyperstructureResourceMultipliers[resource as keyof typeof HyperstructureResourceMultipliers] ?? 0) * amount
        );
      }, 0),
    [hyperstructureTotalCosts],
  );
}

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
    Number(resourceQuantity / BigInt(RESOURCE_PRECISION)) * getResourceMultiplier(resourceType);
  return effectiveContribution / getTotalContributableAmount();
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
