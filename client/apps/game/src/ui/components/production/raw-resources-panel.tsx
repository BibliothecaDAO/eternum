import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ResourcesIds, configManager } from "@bibliothecadao/eternum";
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

    const maxAmounts = rawInputResources.map((input) => {
      const balance = resourceBalances[input.resource] || 0;
      return Math.floor(balance / input.amount);
    });

    return Math.max(1, Math.min(...maxAmounts));
  };

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction());
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer ${
        isSelected ? "border-gold" : "border-transparent opacity-50"
      }`}
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
              <ResourceIcon resource={ResourcesIds[input.resource]} size="sm" />
              <div className="flex items-center justify-between w-full">
                <div className="w-2/3">
                  <NumberInput
                    value={Math.round(input.amount * productionAmount)}
                    onChange={(value) => handleInputChange(value, input.resource)}
                    min={0}
                    max={resourceBalances[input.resource] || 0}
                    className="rounded-md border-gold/30 hover:border-gold/50"
                  />
                </div>
                <span
                  className={`text-sm font-medium ${
                    resourceBalances[input.resource] < input.amount * productionAmount
                      ? "text-order-giants"
                      : "text-gold/60"
                  }`}
                >
                  {balance}
                </span>
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
