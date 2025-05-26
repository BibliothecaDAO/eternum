import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
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
    if (!laborInputResources || !resourceBalances) return 1;

    const maxAmounts = laborInputResources.map((input) => {
      const balance = Math.max((resourceBalances[input.resource] || 0) - 1000, 0);
      return Math.floor((balance / input.amount) * resourceOutputPerInputResources);
    });

    return Math.max(1, Math.min(...maxAmounts));
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
