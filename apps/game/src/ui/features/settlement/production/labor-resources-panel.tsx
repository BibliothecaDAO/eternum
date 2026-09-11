import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
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
    <div className="cursor-pointer space-y-1" onClick={onSelect}>
      <div className={HUD_LABEL}>Labor required</div>
      {laborInputResources?.map((input) => {
        const balance = resourceBalances[input.resource] || 0;
        const needed = Math.round((input.amount * productionAmount) / resourceOutputPerInputResources);
        const isShort = balance < needed;
        return (
          <div key={input.resource} className="flex items-center gap-2 py-0.5">
            <ResourceIcon resource={ResourcesIds[input.resource]} size="sm" withTooltip={false} />
            <span className={cn(HUD_VALUE, "w-24 shrink-0 tabular-nums", isShort && "text-red-300")}>
              {balance.toLocaleString()}
            </span>
            <NumberInput
              value={needed}
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
