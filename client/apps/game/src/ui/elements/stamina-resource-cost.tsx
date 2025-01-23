import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { configManager, ID } from "@bibliothecadao/eternum";
import { useStaminaManager } from "@bibliothecadao/react";
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
  const { currentArmiesTick } = useBlockTimestamp();
  const staminaManager = useStaminaManager(travelingEntityId || 0);

  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const destinationHex = useMemo(() => {
    if (!stamina) return;
    const costs =
      travelLength * (isExplored ? -configManager.getTravelStaminaCost() : -configManager.getExploreStaminaCost());
    const balanceColor = stamina !== undefined && stamina.amount < costs ? "text-red/90" : "text-green/90";
    return { isExplored, costs, balanceColor, balance: stamina.amount };
  }, [stamina, travelLength]);

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
