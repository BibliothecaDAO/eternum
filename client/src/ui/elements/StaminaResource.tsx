import { useStamina } from "@/hooks/helpers/useStamina";
import { EternumGlobalConfig, ID } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const StaminaResource = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const { useStaminaByEntityId, getMaxStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: entityId || 0 });
  const maxStamina = getMaxStaminaByEntityId(entityId || 0);

  const staminaAmount = Number(stamina?.amount || 0);
  const staminaPercentage = (staminaAmount / maxStamina) * 100;

  const staminaColor = staminaAmount < EternumGlobalConfig.stamina.travelCost ? "bg-red-500" : "bg-yellow-500";

  return (
    <div className={`flex flex-col text-xs font-bold uppercase self-center ${className}`}>
      <div className="bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 border border-y w-16">
        <div className={`${staminaColor} h-1 rounded-full  bg-yellow`} style={{ width: `${staminaPercentage}%` }}></div>
      </div>
    </div>
  );
};
