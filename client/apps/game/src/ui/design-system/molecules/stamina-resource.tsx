import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, ID, TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ProgressBar } from "./progress-bar";

export const StaminaResource = ({
  stamina,
  maxStamina,
  className,
}: {
  entityId: ID | undefined;
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
  className?: string;
}) => {
  const staminaPercentage = useMemo(() => (Number(stamina.amount) / maxStamina) * 100, [stamina.amount, maxStamina]);

  const staminaColor = useMemo(() => {
    const minStaminaCost = configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman);
    const percentage = (Number(stamina.amount) / maxStamina) * 100;
    // Use color system based on stamina percentage thresholds
    if (stamina.amount < minStaminaCost) {
      return "bg-red-500"; // Critical - can't travel
    } else if (percentage > 66) {
      return "bg-green-500"; // Good
    } else if (percentage > 33) {
      return "bg-amber-500"; // Medium
    } else {
      return "bg-red-500"; // Low
    }
  }, [stamina.amount, maxStamina]);

  if (maxStamina === 0) return null;

  return (
    <ProgressBar
      valueText={`${Number(stamina.amount)}/${maxStamina}`}
      percentage={staminaPercentage}
      fillColor={staminaColor}
      icon={<Lightning className="fill-order-power w-2 ml-0.5" />}
      tooltipContent={`Stamina: ${Number(stamina.amount)} / ${maxStamina}`}
      className={className}
    />
  );
};
