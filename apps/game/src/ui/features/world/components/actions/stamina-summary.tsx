import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { configManager } from "@bibliothecadao/eternum";
import type { ActionPath } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useStaminaManager } from "@/hooks/helpers/use-stamina";
import { getPathStaminaCost } from "@/hooks/exploration-automation-planner";
import clsx from "clsx";
import { useMemo } from "react";

import { formatAmount } from "./format-amount";
import { staminaTone } from "./stamina-tone";

interface StaminaSummaryProps {
  selectedEntityId: ID | undefined;
  isExplored: boolean;
  path: ActionPath[];
}

export const StaminaSummary = ({ selectedEntityId, isExplored, path }: StaminaSummaryProps) => {
  const currentArmiesTick = useCurrentArmiesTick();
  const staminaManager = useStaminaManager(selectedEntityId || 0);
  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const totalCost = useMemo(() => getPathStaminaCost(path), [path]);

  const requiredStamina = Math.max(0, isExplored ? totalCost : configManager.getExploreStaminaCost());
  const { color: statusColor } = staminaTone(stamina?.amount, requiredStamina);
  const displayRequired = requiredStamina === 0 ? "0" : `-${formatAmount(requiredStamina)}`;

  return <span className={clsx(statusColor, "text-xs font-semibold")}>{displayRequired}</span>;
};
