import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  formatTime,
  multiplyByPrecision,
  ResourceManager,
} from "@bibliothecadao/eternum";
import {
  ID,
  findResourceById,
  TickIds,
} from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  maxCapacityKg,
  size = "default",
  hideZeroBalance = false,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  maxCapacityKg: number;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);

  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  const getBalance = useCallback(() => {
    return resourceManager.balanceWithProduction(currentTick, resourceId, false);
  }, [resourceManager, currentTick]);

  const production = useMemo(() => {
    const balance = getBalance();
    setBalance(balance);
    return resourceManager.getProduction(resourceId);
  }, [getBalance, resourceManager]);

  const maxAmountStorable = useMemo(() => {
    return multiplyByPrecision(maxCapacityKg / configManager.getResourceWeightKg(resourceId));
  }, [maxCapacityKg, resourceId]);

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  const productionRate = useMemo(() => {
    return Number(divideByPrecision(Number(production?.production_rate || 0), false));
  }, [production]);

  const productionEndsAt = useMemo(() => {
    return resourceManager.getProductionEndsAt(resourceId);
  }, [resourceManager]);

  const isActive = useMemo(() => {
    return resourceManager.isActive(resourceId);
  }, [resourceManager]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    let realTick = currentTick;

    const newBalance = resourceManager.balanceWithProduction(realTick, resourceId);
    setBalance(newBalance);

    if (isActive) {
      const interval = setInterval(() => {
        realTick += 1;
        const newBalance = resourceManager.balanceWithProduction(realTick, resourceId);
        setBalance(newBalance);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [resourceManager, currentTick, isActive]);

  const icon = useMemo(() => {
    return (
      <ResourceIcon
        withTooltip={false}
        resource={findResourceById(resourceId)?.trait as string}
        size={size === "large" ? "md" : "sm"}
        className="mr-3 self-center"
      />
    );
  }, [resourceId, size]);

  const reachedMaxCap = useMemo(() => {
    return maxAmountStorable <= balance;
  }, [maxAmountStorable, balance]);

  const handleMouseEnter = useCallback(() => {
    setTooltip({
      position: "top",
      content: <>{findResourceById(resourceId)?.trait as string}</>,
    });
    setShowPerHour(false);
  }, [resourceId, setTooltip]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setShowPerHour(true);
  }, [setTooltip]);

  const togglePopup = useUIStore((state) => state.togglePopup);

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  if (hideZeroBalance && balance <= 0) {
    return null;
  }

  return (
    <div
      className={`flex relative group items-center ${size === "large" ? "text-base px-3 p-2" : "text-sm px-2 p-1.5"
        } hover:bg-gold/20`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon}
      <div className="grid grid-cols-10 w-full">
        <div className={`self-center font-bold col-span-3 ${size === "large" ? "text-lg" : ""}`}>
          {currencyFormat(balance ? Number(balance) : 0, 2)}
        </div>

        <div className={`self-center m-y-auto font-bold col-span-4 text-center ${size === "large" ? "text-lg" : ""}`}>
          {timeUntilValueReached !== 0 ? formatTime(timeUntilValueReached) : ""}
        </div>

        {isActive && (productionEndsAt > currentTick || resourceManager.isFood(resourceId)) ? (
          <div
            className={`${productionRate < 0 ? "text-light-red" : "text-green/80"
              } self-center px-2 flex font-bold ${size === "large" ? "text-lg" : "text-xs"} col-span-3 text-center mx-auto`}
          >
            <div className={`self-center`}>
              +
              {showPerHour
                ? `${currencyIntlFormat(productionRate * 60 * 60, 4)}/h`
                : `${currencyIntlFormat(productionRate, 4)}/s`}
            </div>
          </div>
        ) : (
          <div
            onMouseEnter={() => {
              setTooltip({
                position: "top",
                content: (
                  <>
                    {reachedMaxCap
                      ? "Production has stopped because the max balance has been reached"
                      : "Production has stopped because labor has been depleted"}
                  </>
                ),
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className={`self-center px-2 col-span-3 mx-auto ${size === "large" ? "text-base" : "text-sm"} font-medium`}
          >
            {reachedMaxCap ? "MaxCap" : ""}
          </div>
        )}
      </div>
      <button onClick={() => togglePopup(resourceId.toString())} className="ml-2 p-1 hover:bg-gold/20 rounded">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`${size === "large" ? "h-6 w-6" : "h-5 w-5"} text-gold`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </button>
    </div>
  );
};
