import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { configManager } from "@bibliothecadao/eternum";
import type { ActionPath } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useStaminaManager } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo } from "react";

import { formatAmount } from "./format-amount";

export interface StaminaSummaryProps {
  selectedEntityId: ID | undefined;
  isExplored: boolean;
  path: ActionPath[];
}

export const StaminaSummary = ({ selectedEntityId, isExplored, path }: StaminaSummaryProps) => {
  const { currentArmiesTick } = useBlockTimestamp();
  const staminaManager = useStaminaManager(selectedEntityId || 0);
  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const totalCost = useMemo(() => {
    return path.reduce((acc, tile) => acc + (tile.staminaCost ?? 0), 0);
  }, [path]);

  const requiredStamina = Math.max(0, isExplored ? totalCost : configManager.getExploreStaminaCost());
  const currentStamina = Number(stamina.amount ?? 0n);
  const staminaRatio = requiredStamina === 0 ? Number.POSITIVE_INFINITY : currentStamina / requiredStamina;
  const statusColor =
    staminaRatio >= 1 ? "text-order-brilliance" : staminaRatio >= 0.5 ? "text-gold" : "text-order-giants";
  const displayRequired = requiredStamina === 0 ? "0" : `-${formatAmount(requiredStamina)}`;

  return <span className={clsx(statusColor, "text-xs font-semibold")}>{displayRequired}</span>;
};
