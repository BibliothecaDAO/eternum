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

    // Use more granular color system based on stamina percentage
    if (stamina.amount < minStaminaCost) {
      return "bg-danger"; // Critical - can't travel
    } else if (percentage < 25) {
      return "bg-danger"; // Very low
    } else if (percentage < 50) {
      return "bg-orange"; // Medium-low
    } else if (percentage < 75) {
      return "bg-yellow"; // Medium
    } else {
      return "bg-brilliance"; // Good
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
