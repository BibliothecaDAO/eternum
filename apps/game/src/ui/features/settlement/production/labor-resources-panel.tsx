import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";

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
    <div className={`cursor-pointer`} onClick={onSelect}>
      <div>
        {laborInputResources?.map((input) => {
          const balance = resourceBalances[input.resource] || 0;
          return (
            <div key={input.resource} className="flex items-center gap-3 my-1  transition-colors">
              <ResourceIcon resource={ResourcesIds[input.resource]} size="lg" />
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xl font-bold ${
                    resourceBalances[input.resource] <
                    Math.round((input.amount * productionAmount) / resourceOutputPerInputResources)
                      ? "text-order-giants"
                      : "text-gold"
                  }`}
                >
                  {balance.toLocaleString()}
                </span>
                <div className="w-2/3">
                  <NumberInput
                    value={Math.round((input.amount * productionAmount) / resourceOutputPerInputResources)}
                    onChange={(value) => handleInputChange(value, input.resource)}
                    min={0}
                    className="rounded-md border-gold/30 hover:border-gold/50"
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
