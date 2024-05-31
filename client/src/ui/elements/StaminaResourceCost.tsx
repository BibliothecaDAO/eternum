import { useStamina } from "@/hooks/helpers/useStamina";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";

export const StaminaResourceCost = ({
  travelingEntityId,
  travelLength,
  isExplored,
}: {
  travelingEntityId: bigint | undefined;
  travelLength: number;
  isExplored: boolean;
}) => {
  const { useStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: travelingEntityId || 0n });

  const destinationHex = useMemo(() => {
    if (!stamina) return;
    const costs =
      travelLength * (isExplored ? EternumGlobalConfig.stamina.travelCost : EternumGlobalConfig.stamina.exploreCost);
    const balanceColor = stamina !== undefined && stamina.amount < costs ? "text-red/90" : "text-green/90";
    return { isExplored, costs, balanceColor, balance: stamina.amount };
  }, [stamina]);

  return (
    destinationHex && (
      <div className="flex flex-row p-1 text-xs">
        <div className="text-lg p-1 pr-3">⚡️</div>
        <div className="flex flex-col">
          <div>
            {destinationHex?.costs}{" "}
            <span className={clsx(destinationHex.balanceColor, "font-normal")}>({destinationHex.balance})</span>
          </div>
          <div>Stamina</div>
        </div>
      </div>
    )
  );
};
