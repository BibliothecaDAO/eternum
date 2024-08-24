import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { useStamina } from "@/hooks/helpers/useStamina";
import { ConfigManager, ID, TravelTypes } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";

export const StaminaResourceCost = ({
  travelingEntityId,
  travelLength,
  isExplored,
}: {
  travelingEntityId: ID | undefined;
  travelLength: number;
  isExplored: boolean;
}) => {
  const config = ClientConfigManager.instance();
  const travelCost = config.getTravelStaminaCost(TravelTypes.Travel);
  const exploreCost = config.getTravelStaminaCost(TravelTypes.Explore);

  const { useStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: travelingEntityId || 0 });

  const destinationHex = useMemo(() => {
    if (!stamina) return;
    const costs = travelLength * (isExplored ? -travelCost : -exploreCost);
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
