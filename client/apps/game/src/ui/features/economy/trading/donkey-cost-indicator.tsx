import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { memo } from "react";

interface DonkeyCostIndicatorProps {
  donkeysNeeded: number;
  donkeyBalance: number;
  canTransport: boolean;
}

export const DonkeyCostIndicator = memo(({ donkeysNeeded, donkeyBalance, canTransport }: DonkeyCostIndicatorProps) => {
  if (donkeysNeeded === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${canTransport ? "text-green" : "text-red"}`}>
      <ResourceIcon resource="Donkey" size="xs" withTooltip={false} />
      <span>{donkeysNeeded} needed</span>
      <span className="text-gold/50">({donkeyBalance} avail.)</span>
    </div>
  );
});

DonkeyCostIndicator.displayName = "DonkeyCostIndicator";
