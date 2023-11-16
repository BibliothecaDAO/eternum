import { initialResources } from "@bibliothecadao/eternum";

export const getLevelingCost = (newLevel: number): { resourceId: number; amount: number }[] => {
  const costResources = [];
  for (let i = 0; i < initialResources.length; i++) {
    costResources.push({
      resourceId: i + 1,
      amount: Math.floor((initialResources[i] * 1000) / 4),
    });
  }
  return costResources;
};
