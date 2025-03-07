import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat, currencyIntlFormat, gramToKg } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  findResourceById,
  formatTime,
  ID,
  ResourceManager,
  TickIds,
  TimeFormat,
} from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  maxStorehouseCapacityKg,
  tick,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  maxStorehouseCapacityKg: number;
  tick: number;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);

  const getBalance = useCallback(() => {
    return resourceManager.balanceWithProduction(tick, resourceId);
  }, [resourceManager, tick]);

  const production = useMemo(() => {
    const balance = getBalance();
    setBalance(balance);
    return resourceManager.getProduction(resourceId);
  }, [getBalance, resourceManager]);

  const maxAmountStorable = useMemo(() => {
    return maxStorehouseCapacityKg / gramToKg(configManager.getResourceWeightKg(resourceId) || 1000);
  }, [maxStorehouseCapacityKg, resourceId]);

  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  const productionRate = useMemo(() => {
    return Number(divideByPrecision(Number(production?.production_rate || 0)));
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
        size="sm"
        className="mr-3 self-center"
      />
    );
  }, [resourceId]);

  const reachedMaxCap = useMemo(() => {
    return maxAmountStorable === balance && isActive;
  }, [maxAmountStorable, balance, isActive]);

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

  return (
    <div
      className={`flex relative group items-center text-xs px-2 p-1 hover:bg-gold/20`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon}
      <div className="grid grid-cols-10 w-full">
        <div className="self-center font-bold col-span-3">{currencyFormat(balance ? Number(balance) : 0, 2)}</div>

        <div className="self-center m-y-auto font-bold col-span-4 text-center">
          {timeUntilValueReached !== 0
            ? formatTime(timeUntilValueReached, TimeFormat.D | TimeFormat.H | TimeFormat.M)
            : ""}
        </div>

        {isActive && (productionEndsAt > currentTick || resourceManager.isFood(resourceId)) ? (
          <div
            className={`${
              productionRate < 0 ? "text-light-red" : "text-green/80"
            } self-center px-2 flex font-bold text-[10px] col-span-3 text-center mx-auto`}
          >
            <div className={`self-center`}>
              +
              {showPerHour
                ? `${currencyIntlFormat(productionRate * 60 * 60, 2)}/h`
                : `${currencyIntlFormat(productionRate, 2)}/s`}
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
            className="self-center px-2 col-span-3 mx-auto"
          >
            {reachedMaxCap ? "MaxCap" : ""}
          </div>
        )}
      </div>
      <button onClick={() => togglePopup(resourceId.toString())} className="ml-2 p-1 hover:bg-gold/20 rounded">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gold"
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
