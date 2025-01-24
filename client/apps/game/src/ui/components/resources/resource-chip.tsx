import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat, currencyIntlFormat, divideByPrecision, gramToKg } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, findResourceById, formatTime, ID, TickIds, TimeFormat } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RealmTransfer } from "./realm-transfer";

export const ResourceChip = ({
  resourceId,
  entityId,
  maxStorehouseCapacityKg,
  tick,
}: {
  isLabor?: boolean;
  resourceId: ID;
  entityId: ID;
  maxStorehouseCapacityKg: number;
  tick: number;
}) => {
  const resourceManager = useResourceManager(entityId, resourceId);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [showPerHour, setShowPerHour] = useState(true);

  const [balance, setBalance] = useState(0);

  const getBalance = useCallback(() => {
    return resourceManager.balance(tick);
  }, [resourceManager, tick]);

  const getProduction = useCallback(() => {
    return resourceManager.getProduction();
  }, [resourceManager]);

  const production = useMemo(() => {
    setBalance(getBalance());
    return getProduction();
  }, [getBalance, getProduction]);

  const maxAmountStorable = useMemo(() => {
    return maxStorehouseCapacityKg / gramToKg(configManager.getResourceWeight(resourceId) || 1000);
  }, [maxStorehouseCapacityKg, resourceId]);

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(getBlockTimestamp().currentDefaultTick, 0);
  }, [resourceManager, production?.production_rate]);

  const productionRate = useMemo(() => {
    return Number(divideByPrecision(Number(production?.production_rate || 0)));
  }, [production]);

  const productionEndsAt = useMemo(() => {
    return resourceManager.getProductionEndsAt();
  }, [production]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;

    let realTick = getBlockTimestamp().currentDefaultTick;

    const newBalance = resourceManager.balance(realTick);
    setBalance(newBalance);

    if (Math.abs(productionRate) > 0) {
      const interval = setInterval(() => {
        realTick += 1;
        const newBalance = resourceManager.balance(realTick);
        setBalance(newBalance);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [setBalance, resourceManager, resourceId, production]);

  const icon = useMemo(
    () => (
      <ResourceIcon
        withTooltip={false}
        resource={findResourceById(resourceId)?.trait as string}
        size="sm"
        className="mr-3 self-center"
      />
    ),
    [resourceId],
  );

  const reachedMaxCap = useMemo(() => {
    return maxAmountStorable === balance && Math.abs(productionRate) > 0;
  }, [maxAmountStorable, balance, production]);

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
    <>
      <RealmTransfer balance={balance} resource={resourceId} tick={tick} />
      <div
        className={`flex relative group items-center text-xs px-2 p-1 hover:bg-gold/20 `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          togglePopup(resourceId.toString());
        }}
      >
        {icon}
        <div className="grid grid-cols-10 w-full">
          <div className="self-center font-bold col-span-3">{currencyFormat(balance ? Number(balance) : 0, 2)}</div>

          <div className="self-center m-y-auto font-bold col-span-4 text-center">
            {timeUntilValueReached !== 0
              ? formatTime(timeUntilValueReached, TimeFormat.D | TimeFormat.H | TimeFormat.M)
              : ""}
          </div>

          {Math.abs(productionRate) > 0 && productionEndsAt > getBlockTimestamp().currentDefaultTick ? (
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
      </div>
    </>
  );
};
