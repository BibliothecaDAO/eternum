import { ClientComponents } from "@/dojo/createClientComponents";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientConfigManager } from "../ConfigManager";

export function computeInitialContributionPoints(
  resourceType: ResourcesIds,
  resourceQuantity: bigint,
  totalPoints: number,
): number {
  return getTotalPointsPercentage(resourceType, resourceQuantity) * totalPoints;
}

export function getTotalPointsPercentage(resourceType: ResourcesIds, resourceQuantity: bigint): number {
  const configManager = ClientConfigManager.instance();

  const effectiveContribution =
    Number(resourceQuantity / BigInt(configManager.getResourcePrecision())) *
    configManager.getResourceRarity(resourceType);
  const totalContributableAmount = configManager.getHyperstructureTotalContributableAmount();

  return effectiveContribution / totalContributableAmount;
}

export const calculateCompletionPoints = (
  contributions: ComponentValue<ClientComponents["Contribution"]["schema"]>[],
) => {
  const configManager = ClientConfigManager.instance();
  const pointsOnCompletion = configManager.getHyperstructureConfig().pointsOnCompletion;

  return contributions.reduce((acc, contribution) => {
    return acc + computeInitialContributionPoints(contribution.resource_type, contribution.amount, pointsOnCompletion);
  }, 0);
};
