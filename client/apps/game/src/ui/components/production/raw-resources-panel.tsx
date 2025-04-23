import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
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
  outputResource: any;
}

export const RawResourcesPanel = ({
  selectedResource,
  productionAmount,
  setProductionAmount,
  resourceBalances,
  isSelected,
  onSelect,
  outputResource,
}: RawResourcesPanelProps) => {
  const rawInputResources = useMemo(() => {
    return configManager.complexSystemResourceInputs[selectedResource].map((resource) => ({
      ...resource,
      amount: resource.amount / outputResource.amount,
    }));
  }, [selectedResource, outputResource]);

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
    <div
      className={`p-4 border-2 cursor-pointer ${isSelected ? "panel-gold bg-gold/5" : "border-transparent opacity-50"}`}
      onClick={onSelect}
    >
      <h4 className="text-xl mb-2">Raw Resources</h4>
      <div className="space-y-2">
        {rawInputResources?.map((input) => {
          const balance = resourceBalances[input.resource] || 0;
          return (
            <div
              key={input.resource}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors"
            >
              <ResourceIcon resource={ResourcesIds[input.resource]} size="lg" />
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xl font-medium ${
                    resourceBalances[input.resource] < input.amount * productionAmount
                      ? "text-order-giants"
                      : "text-gold"
                  }`}
                >
                  {balance}
                </span>
                <div>
                  <NumberInput
                    value={Math.round(input.amount * productionAmount)}
                    onChange={(value) => handleInputChange(value, input.resource)}
                    min={0}
                    max={resourceBalances[input.resource] || 0}
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
