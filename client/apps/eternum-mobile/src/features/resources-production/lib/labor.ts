import { configManager, ResourcesIds } from "@bibliothecadao/eternum";
import { LaborConfig } from "../model/types";

export const getLaborConfig = (resourceId: number): LaborConfig | undefined => {
  const laborConfig = configManager.resourceLaborOutput[resourceId as keyof typeof configManager.resourceLaborOutput];

  if (!laborConfig) return undefined;

  const laborResource = configManager.resourceOutput[ResourcesIds.Labor as keyof typeof configManager.resourceOutput];

  const depreciation = (100 - laborConfig.depreciation_percent_num) / laborConfig.depreciation_percent_denom;

  return {
    laborProductionPerResource: laborConfig.resource_rarity,
    laborBurnPerResource: laborConfig.resource_rarity / depreciation,
    laborRatePerTick: laborResource.amount,
    inputResources: [
      { resource: ResourcesIds.Labor, amount: laborConfig.resource_rarity / depreciation },
      {
        resource: ResourcesIds.Wheat,
        amount: (laborConfig.wheat_burn_per_labor * laborConfig.resource_rarity) / depreciation,
      },
      {
        resource: ResourcesIds.Fish,
        amount: (laborConfig.fish_burn_per_labor * laborConfig.resource_rarity) / depreciation,
      },
    ],
  };
};

export const calculateLaborAmount = (
  selectedResources: { id: number; amount: number }[],
  laborConfigs: (LaborConfig | undefined)[],
): { laborAmount: number; ticks: number } => {
  if (!laborConfigs.length) return { laborAmount: 0, ticks: 0 };

  const totalLaborAmount = selectedResources.reduce((acc, resource, index) => {
    return acc + resource.amount * (laborConfigs[index]?.laborProductionPerResource ?? 0);
  }, 0);

  const maxTicks = Math.max(
    ...laborConfigs.map((config, index) => {
      return Math.ceil(
        (selectedResources[index].amount * (config?.laborProductionPerResource || 0)) / (config?.laborRatePerTick || 0),
      );
    }),
  );

  return { laborAmount: totalLaborAmount, ticks: maxTicks };
};
