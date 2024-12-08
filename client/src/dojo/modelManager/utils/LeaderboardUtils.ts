import { ClientComponents } from "@/dojo/createClientComponents";
import { configManager } from "@/dojo/setup";
import { divideByPrecision } from "@/ui/utils/utils";
import { Resource } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientConfigManager } from "../ConfigManager";

export function computeInitialContributionPoints(
  hyperstructureId: number,
  contributions: Resource[],
  totalPoints: number,
): number {
  return getContributionsTotalPercentage(hyperstructureId, contributions) * totalPoints;
}

function getContributionsTotalPercentage(hyperstructureId: number, contributions: Resource[]): number {
  const totalPlayerContribution = divideByPrecision(
    contributions.reduce((acc, { amount, resourceId }) => {
      return acc + amount * configManager.getResourceRarity(resourceId);
    }, 0),
  );

  const totalHyperstructureContribution = configManager.getHyperstructureTotalContributableAmount(hyperstructureId);

  return totalPlayerContribution / totalHyperstructureContribution;
}

export const calculateCompletionPoints = (
  contributions: ComponentValue<ClientComponents["Contribution"]["schema"]>[],
) => {
  const configManager = ClientConfigManager.instance();
  const pointsOnCompletion = configManager.getHyperstructureConfig().pointsOnCompletion;

  if (contributions.length === 0) {
    return 0;
  }
  const hyperstructureId = contributions[0].hyperstructure_entity_id;

  const formattedContributions = contributions.map((contribution) => {
    return {
      resourceId: contribution.resource_type,
      amount: Number(contribution.amount),
    };
  });

  return computeInitialContributionPoints(hyperstructureId, formattedContributions, pointsOnCompletion);
};
