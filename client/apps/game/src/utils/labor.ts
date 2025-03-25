import { configManager, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/eternum";

type LaborConfig = {
  laborProductionPerResource: number;
  laborBurnPerResource: number;
  laborRatePerTick: number;
  inputResources: { resource: ResourcesIds; amount: number }[];
};

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
