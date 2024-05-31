import { useStamina } from "@/hooks/helpers/useStamina";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const StaminaResource = ({ entityId, className }: { entityId: bigint; className?: string }) => {
  const { useStaminaByEntityId, getMaxStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: entityId });

  const staminaColor =
    stamina !== undefined && stamina.amount < EternumGlobalConfig.stamina.travelCost ? "text-red/90" : "text-green/90";

  return (
    <div className={`flex flex-row p-1 text-xs ${className}`}>
      <div className="text-lg p-1 pr-3">⚡️</div>
      <div className={clsx(staminaColor, "flex", "flex-col")}>
        <div>
          {stamina.amount} / {getMaxStaminaByEntityId(entityId)}
        </div>
        <div>Stamina</div>
      </div>
    </div>
  );
};
