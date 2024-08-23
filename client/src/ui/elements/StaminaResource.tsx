import { useStamina, useStaminaManager } from "@/hooks/helpers/useStamina";
import useUIStore from "@/hooks/store/useUIStore";
import { EternumGlobalConfig, ID } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const StaminaResource = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const currentArmiesTick = useUIStore((state) => state.currentArmiesTick);
  const { useStaminaByEntityId, getMaxStaminaByEntityId } = useStamina();

  const staminaManager = useStaminaManager(entityId || 0);

  const maxStamina = getMaxStaminaByEntityId(entityId || 0);

  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const staminaAmount = useMemo(() => Number(stamina?.amount || 0), [stamina]);
  const staminaPercentage = useMemo(() => (staminaAmount / maxStamina) * 100, [staminaAmount, maxStamina]);

  const staminaColor = useMemo(
    () => (staminaAmount < EternumGlobalConfig.stamina.travelCost ? "bg-red-500" : "bg-yellow-500"),
    [staminaAmount],
  );

  return (
    <div className={`flex flex-col text-xs font-bold uppercase self-center ${className}`}>
      <div className="bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 border border-y w-16">
        <div className={`${staminaColor} h-1 rounded-full  bg-yellow`} style={{ width: `${staminaPercentage}%` }}></div>
      </div>
    </div>
  );
};
