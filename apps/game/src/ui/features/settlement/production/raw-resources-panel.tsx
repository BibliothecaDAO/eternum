import { HudButton } from "@/ui/design-system/kit/hud-elements";

import { ResourceInputRow } from "./resource-input-row";

interface RawResourcesPanelProps {
  /** Each input per unit of output; undefined when the recipe is unknown here. */
  inputs: { resource: number; amount: number }[] | undefined;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  resourceBalances: Record<number, number>;
  isSelected: boolean;
  onSelect: () => void;
}

export const RawResourcesPanel = ({
  inputs,
  productionAmount,
  setProductionAmount,
  resourceBalances,
  isSelected,
  onSelect,
}: RawResourcesPanelProps) => {
  const handleInputChange = (value: number, inputResource: number) => {
    const resourceConfig = inputs?.find((r) => r.resource === inputResource);
    if (!resourceConfig) return;
    const newAmount = value / resourceConfig.amount;
    setProductionAmount(newAmount);
  };

  const calculateMaxProduction = () => {
    if (!inputs || !resourceBalances) return 1;

    let minCycle = 1 << 30;
    inputs.forEach((input) => {
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
      <div className="text-hud-label text-hud-muted">Resources required</div>
      {inputs === undefined && <div className="text-hud-strong">—</div>}
      {inputs?.map((input) => (
        <ResourceInputRow
          key={input.resource}
          resource={input.resource}
          held={resourceBalances[input.resource] || 0}
          needed={Math.round(input.amount * productionAmount)}
          onNeeded={(value) => handleInputChange(value, input.resource)}
        />
      ))}
      <HudButton kind="secondary" size="sm" onClick={handleMaxClick}>
        Max
      </HudButton>
    </div>
  );
};
