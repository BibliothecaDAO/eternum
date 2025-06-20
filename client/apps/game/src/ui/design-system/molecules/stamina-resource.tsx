import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, ID, TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";

export const StaminaResource = ({
  stamina,
  maxStamina,
  className,
}: {
  entityId: ID | undefined;
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const staminaPercentage = useMemo(() => (Number(stamina.amount) / maxStamina) * 100, [stamina.amount, maxStamina]);

  const staminaColor = useMemo(
    () =>
      // smallest possible stamina cost
      stamina.amount < configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman)
        ? "bg-red"
        : "bg-yellow",
    [stamina.amount],
  );

  return (
    maxStamina !== 0 && (
      <div className="flex flex-row text-xxs">
        <div className="mr-1">{`${Number(stamina.amount)}/${maxStamina}`}</div>
        <div
          onMouseEnter={() => {
            setTooltip({
              content: `Stamina: ${Number(stamina.amount)} / ${maxStamina}`,
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
