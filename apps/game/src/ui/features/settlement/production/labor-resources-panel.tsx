import { HudButton } from "@/ui/design-system/kit/hud-elements";

import { ResourceInputRow } from "./resource-input-row";

interface LaborResourcesPanelProps {
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  resourceBalances: Record<number, number>;
  onSelect: () => void;
  laborInputResources: { resource: number; amount: number }[];
  resourceOutputPerInputResources: number;
}

export const LaborResourcesPanel = ({
  productionAmount,
  setProductionAmount,
  resourceBalances,
  onSelect,
  laborInputResources,
  resourceOutputPerInputResources,
}: LaborResourcesPanelProps) => {
  const handleInputChange = (value: number, inputResource: number) => {
    if (!laborInputResources) return;
    const resourceConfig = laborInputResources.find((r) => r.resource === inputResource);
    if (!resourceConfig) return;
    const newAmount = (value / resourceConfig.amount) * resourceOutputPerInputResources;
    setProductionAmount(newAmount);
  };

  const calculateMaxProduction = () => {
    if (!laborInputResources.length || !resourceBalances || resourceOutputPerInputResources <= 0) return 0;

    let maxCycles = Number.MAX_SAFE_INTEGER;

    laborInputResources.forEach((input) => {
      if (input.amount <= 0) return;
      const balance = resourceBalances[input.resource] || 0;
      const cyclesForResource = Math.floor(balance / input.amount);
      if (cyclesForResource < maxCycles) {
        maxCycles = cyclesForResource;
      }
    });

    if (!Number.isFinite(maxCycles) || maxCycles <= 0) return 0;

    return Math.floor(maxCycles * resourceOutputPerInputResources);
  };

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction());
  };

  return (
    <div className="cursor-pointer space-y-1" onClick={onSelect}>
      <div className="text-hud-label text-hud-muted">Labor required</div>
      {laborInputResources?.map((input) => (
        <ResourceInputRow
          key={input.resource}
          resource={input.resource}
          held={resourceBalances[input.resource] || 0}
          needed={Math.round((input.amount * productionAmount) / resourceOutputPerInputResources)}
          onNeeded={(value) => handleInputChange(value, input.resource)}
        />
      ))}
      <HudButton kind="secondary" size="sm" onClick={handleMaxClick}>
        Max
      </HudButton>
    </div>
  );
};
