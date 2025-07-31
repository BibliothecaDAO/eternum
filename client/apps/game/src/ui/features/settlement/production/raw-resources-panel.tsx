import { NumberInput } from "@/ui/design-system/atoms/number-input";
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
    <div className={`cursor-pointer`} onClick={onSelect}>
      <div className="">
        <h4 className="text-sm font-semibold text-gold/80 mb-2">Resources Required:</h4>
        {rawInputResources?.map((input) => {
          const balance = resourceBalances[input.resource] || 0;
          return (
            <div key={input.resource} className="flex items-center gap-3 my-1  transition-colors">
              <ResourceIcon resource={ResourcesIds[input.resource]} size="lg" />
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xl font-medium ${
                    resourceBalances[input.resource] < input.amount * productionAmount
                      ? "text-order-giants"
                      : "text-gold"
                  }`}
                >
                  {balance.toLocaleString()}
                </span>
                <div>
                  <NumberInput
                    value={Math.round(input.amount * productionAmount)}
                    onChange={(value) => handleInputChange(value, input.resource)}
                    min={0}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <button
          onClick={handleMaxClick}
          className="mt-2 px-3 py-1 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
        >
          MAX
        </button>
      </div>
    </div>
  );
};
