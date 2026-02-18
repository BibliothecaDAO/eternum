export interface ResourceCostInput {
  resourceId: number;
  name: string;
  amount: number;
}

export function computeBuildingCost(
  baseCosts: ResourceCostInput[],
  existingCount: number,
  costPercentIncrease: number,
): ResourceCostInput[] {
  return baseCosts.map((cost) => {
    const scalingFactor = existingCount * existingCount * (costPercentIncrease / 100);
    const scaledAmount = cost.amount + cost.amount * scalingFactor;

    return {
      resourceId: cost.resourceId,
      name: cost.name,
      amount: Math.floor(scaledAmount),
    };
  });
}
