import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { ActionPath, configManager } from "@bibliothecadao/eternum";
import { useStaminaManager } from "@/hooks/helpers/use-stamina";
import { ID } from "@bibliothecadao/types";
import clsx from "clsx";
import { memo, useMemo } from "react";

import { InfoLabel } from "./info-label";
import { formatAmount } from "./format-amount";
import { staminaTone } from "./stamina-tone";

interface AttackInfoProps {
  selectedEntityId: ID;
  path: ActionPath[];
}

export const AttackInfo = memo(({ selectedEntityId }: AttackInfoProps) => {
  const currentArmiesTick = useCurrentArmiesTick();
  const staminaManager = useStaminaManager(selectedEntityId);
  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const combatParams = useMemo(() => configManager.getCombatConfig(), []);
  const requiredStamina = combatParams.stamina_attack_req;
  const { color: staminaColor, isLow } = staminaTone(stamina?.amount, requiredStamina);
  const displayStaminaCost = requiredStamina === 0 ? "0" : `-${formatAmount(requiredStamina)}`;

  return (
    <div className="mt-1 flex flex-col gap-1 text-xs">
      <InfoLabel variant="mine" className="items-center justify-between gap-2">
        <span className="text-base leading-none">⚡</span>
        <span className={clsx("text-xs font-semibold", staminaColor)}>{displayStaminaCost}</span>
      </InfoLabel>
      {isLow && (
        <InfoLabel variant="attack" className="items-center justify-center gap-1 text-xxs uppercase tracking-[0.2em]">
          <span className="text-[10px] font-semibold">Low stamina</span>
        </InfoLabel>
      )}
    </div>
  );
});
