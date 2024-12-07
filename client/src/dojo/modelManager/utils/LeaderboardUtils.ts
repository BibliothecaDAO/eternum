import { ClientComponents } from "@/dojo/createClientComponents";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientConfigManager } from "../ConfigManager";

export function computeInitialContributionPoints(
  hyperstructureId: number,
  resourceType: ResourcesIds,
  resourceQuantity: bigint,
  totalPoints: number,
): number {
  return getTotalPointsPercentage(hyperstructureId, resourceType, resourceQuantity) * totalPoints;
}

export function getTotalPointsPercentage(
  hyperstructureId: number,
  resourceType: ResourcesIds,
  resourceQuantity: bigint,
): number {
  const configManager = ClientConfigManager.instance();

  const effectiveContribution =
    Number(resourceQuantity / BigInt(configManager.getResourcePrecision())) *
    configManager.getResourceRarity(resourceType);
  const totalContributableAmount = configManager.getHyperstructureTotalContributableAmount(hyperstructureId);

  return effectiveContribution / totalContributableAmount;
}

export const calculateCompletionPoints = (
  contributions: ComponentValue<ClientComponents["Contribution"]["schema"]>[],
) => {
  const configManager = ClientConfigManager.instance();
  const pointsOnCompletion = configManager.getHyperstructureConfig().pointsOnCompletion;

  return contributions.reduce((acc, contribution) => {
    return (
      acc +
      computeInitialContributionPoints(
        contribution.hyperstructure_entity_id,
        contribution.resource_type,
        contribution.amount,
        pointsOnCompletion,
      )
    );
  }, 0);
};
