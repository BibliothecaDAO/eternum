import { useStamina } from "@/hooks/helpers/useStamina";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const StaminaResource = ({ entityId, className }: { entityId: bigint | undefined; className?: string }) => {
  const { useStaminaByEntityId, getMaxStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: entityId || 0n });

  const staminaColor = stamina?.amount || 0n < EternumGlobalConfig.stamina.travelCost ? "text-red/90" : "text-green/90";

  return (
    <div className={`flex flex-row p-1 text-xs ${className}`}>
      <div className="text-lg p-1 pr-3">⚡️</div>
      <div className={clsx(staminaColor, "flex", "flex-col")}>
        <div>
          {stamina?.amount || 0} / {getMaxStaminaByEntityId(entityId || 0n)}
        </div>
        <div>Stamina</div>
      </div>
    </div>
  );
};
