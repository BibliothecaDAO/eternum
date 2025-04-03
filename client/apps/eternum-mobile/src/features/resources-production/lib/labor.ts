import { LaborConfig } from "../model/types";

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
