import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager, StaminaManager } from "@bibliothecadao/eternum";
import { BiomeType, ID, TroopType } from "@bibliothecadao/types";
import { useDojo, useStaminaManager } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

export const StaminaResource = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const { setup } = useDojo();
  const { currentArmiesTick } = useBlockTimestamp();

  const staminaManager = useStaminaManager(entityId || 0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const maxStamina = StaminaManager.getMaxStamina(
    getComponentValue(setup.components.ExplorerTroops, getEntityIdFromKeys([BigInt(entityId || 0)]))?.troops,
  );

  const stamina = useMemo(
    () => staminaManager.getStamina(currentArmiesTick),
    [entityId, currentArmiesTick, staminaManager],
  );

  const staminaAmount = useMemo(() => Number(stamina?.amount || 0), [entityId, stamina]);

  const staminaPercentage = useMemo(() => (staminaAmount / maxStamina) * 100, [staminaAmount, maxStamina]);

  const staminaColor = useMemo(
    () =>
      // smallest possible stamina cost
      staminaAmount < configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman)
        ? "bg-red"
        : "bg-yellow",
    [staminaAmount],
  );

  return (
    maxStamina !== 0 && (
      <div className="flex flex-row text-xxs">
        <div className="mr-1">{`${staminaAmount}/${maxStamina}`}</div>
        <div
          onMouseEnter={() => {
            setTooltip({
              content: `Stamina: ${staminaAmount} / ${maxStamina}`,
              position: "right",
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className={`flex flex-col text-xs font-bold uppercase self-center ${className}`}
        >
          <div className="bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 border border-y w-16">
            <div
              className={`${staminaColor} h-1 rounded-full  bg-yellow`}
              style={{ width: `${staminaPercentage}%` }}
            ></div>
          </div>
        </div>
        <Lightning className="fill-order-power w-2 ml-0.5"></Lightning>
      </div>
    )
  );
};
