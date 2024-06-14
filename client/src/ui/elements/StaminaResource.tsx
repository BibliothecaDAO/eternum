import { useStamina } from "@/hooks/helpers/useStamina";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const StaminaResource = ({ entityId, className }: { entityId: bigint | undefined; className?: string }) => {
  const { useStaminaByEntityId, getMaxStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: entityId || 0n });

  const staminaColor =
    (stamina?.amount || 0n) < EternumGlobalConfig.stamina.travelCost ? "text-red/90" : "text-yellow/90";

  return (
    <div className={`flex flex-row text-xs font-bold text-right ${className}`}>
      {/* <div className="text-lg p-1 pr-3">⚡️</div> */}
      <div className={clsx(staminaColor, "flex", "flex-col")}>
        <div>
          Stamina : {stamina?.amount || 0} / {getMaxStaminaByEntityId(entityId || 0n)}
        </div>
      </div>
    </div>
  );
};
