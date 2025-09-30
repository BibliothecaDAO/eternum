import { ActionPath, configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { useStaminaManager } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import clsx from "clsx";
import { memo, useMemo } from "react";

import { InfoLabel } from "./info-label";
import { formatAmount } from "./format-amount";

interface AttackInfoProps {
  selectedEntityId: ID;
  path: ActionPath[];
}

export const AttackInfo = memo(({ selectedEntityId }: AttackInfoProps) => {
  const { currentArmiesTick } = getBlockTimestamp();
  const staminaManager = useStaminaManager(selectedEntityId);
  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const combatParams = useMemo(() => configManager.getCombatConfig(), []);
  const requiredStamina = combatParams.stamina_attack_req;
  const currentStamina = Number(stamina.amount ?? 0n);
  const staminaRatio = requiredStamina === 0 ? Number.POSITIVE_INFINITY : currentStamina / requiredStamina;
  const staminaColor =
    staminaRatio >= 1 ? "text-order-brilliance" : staminaRatio >= 0.5 ? "text-gold" : "text-order-giants";
  const displayStaminaCost = requiredStamina === 0 ? "0" : `-${formatAmount(requiredStamina)}`;

  return (
    <div className="mt-1 flex flex-col gap-1 text-xs">
      <InfoLabel variant="mine" className="items-center justify-between gap-2">
        <span className="text-base leading-none">⚡</span>
        <span className={clsx("text-xs font-semibold", staminaColor)}>{displayStaminaCost}</span>
      </InfoLabel>
      {staminaRatio < 1 && (
        <InfoLabel variant="attack" className="items-center justify-center gap-1 text-xxs uppercase tracking-[0.2em]">
          <span className="text-[10px] font-semibold">Low stamina</span>
        </InfoLabel>
      )}
    </div>
  );
});
