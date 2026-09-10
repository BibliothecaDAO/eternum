import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

interface RawResourcesPanelProps {
  selectedResource: number;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  resourceBalances: Record<number, number>;
  isSelected: boolean;
  onSelect: () => void;
  outputResourceAmount: number;
}

export const RawResourcesPanel = ({
  selectedResource,
  productionAmount,
  setProductionAmount,
  resourceBalances,
  isSelected,
  onSelect,
  outputResourceAmount,
}: RawResourcesPanelProps) => {
  const rawInputResources = useMemo(() => {
    return configManager.complexSystemResourceInputs[selectedResource].map((resource) => ({
      ...resource,
      amount: resource.amount / outputResourceAmount,
    }));
  }, [selectedResource, outputResourceAmount]);

  const handleInputChange = (value: number, inputResource: number) => {
    const resourceConfig = rawInputResources.find((r) => r.resource === inputResource);
    if (!resourceConfig) return;
    const newAmount = value / resourceConfig.amount;
    setProductionAmount(newAmount);
  };

  const calculateMaxProduction = () => {
    if (!rawInputResources || !resourceBalances) return 1;

    let minCycle = 1 << 30;
    rawInputResources.forEach((input) => {
      const balance = resourceBalances[input.resource] || 0;
      const count = Math.floor(balance / input.amount);
      if (count < minCycle) {
        minCycle = count;
      }
    });

    return Math.max(1, minCycle);
  };

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction());
  };

  return (
    <div className="cursor-pointer space-y-1" onClick={onSelect}>
      <div className={HUD_LABEL}>Resources required</div>
      {rawInputResources?.map((input) => {
        const balance = resourceBalances[input.resource] || 0;
        const isShort = balance < input.amount * productionAmount;
        return (
          <div key={input.resource} className="flex items-center gap-2 py-0.5">
            <ResourceIcon resource={ResourcesIds[input.resource]} size="sm" withTooltip={false} />
            <span className={cn(HUD_VALUE, "w-24 shrink-0 tabular-nums", isShort && "text-red-300")}>
              {balance.toLocaleString()}
            </span>
            <NumberInput
              value={Math.round(input.amount * productionAmount)}
              onChange={(value) => handleInputChange(value, input.resource)}
              min={0}
              className="h-8 flex-1 text-sm"
            />
          </div>
        );
      })}
      <Button variant="outline" size="xs" onClick={handleMaxClick} className="mt-1">
        Max
      </Button>
    </div>
  );
};
