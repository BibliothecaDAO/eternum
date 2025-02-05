import { configManager, ResourcesIds } from "@bibliothecadao/eternum";

type LaborConfig = {
  laborProductionPerResource: number;
  wheatBurnPerLabor: number;
  fishBurnPerLabor: number;
  laborRatePerTick: number;
  resourceProductionPerLabor: number;
};

export const getLaborConfig = (resourceId: number): LaborConfig => {
  const laborConfig = configManager.resourceLaborOutput[resourceId as keyof typeof configManager.resourceLaborOutput];
  const laborResource = configManager.resourceOutput[ResourcesIds.Labor as keyof typeof configManager.resourceOutput];

  const depreciation = (100 - laborConfig.depreciation_percent_num) / laborConfig.depreciation_percent_denom;

  return {
    laborProductionPerResource: laborConfig.resource_rarity,
    resourceProductionPerLabor: (1 / laborConfig.resource_rarity) * depreciation,
    wheatBurnPerLabor: laborConfig.wheat_burn_per_labor,
    fishBurnPerLabor: laborConfig.fish_burn_per_labor,
    laborRatePerTick: laborResource.amount,
  };
};
