import { configManager, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/eternum";
import { LaborConfig } from "../model/types";

export const getLaborConfig = (resourceId: number): LaborConfig | undefined => {
  const laborProducedPerResource = configManager.laborOutputPerResource[resourceId as keyof typeof configManager.laborOutputPerResource];
  const laborResourceOutput
   = configManager.resourceOutputRate[ResourcesIds.Labor as keyof typeof configManager.resourceOutputRate];
  const simpleSystemResourceInputs = configManager.simpleSystemResourceInputs[resourceId as keyof typeof configManager.simpleSystemResourceInputs];
  const laborBurnPerResource = simpleSystemResourceInputs.filter(x=>x.resource == ResourcesIds.Labor)[0] || {resource: resourceId, amount: 0};
  return {
    laborProductionPerResource: laborProducedPerResource.amount / RESOURCE_PRECISION,
    laborBurnPerResource: laborBurnPerResource.amount,
    laborRatePerTick: laborResourceOutput.realm_output_per_second / RESOURCE_PRECISION,
    inputResources: simpleSystemResourceInputs,
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
