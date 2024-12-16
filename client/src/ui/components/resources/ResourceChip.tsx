import { findResourceById, getIconResourceId, ID, TickIds } from "@bibliothecadao/eternum";

import { configManager } from "@/dojo/setup";
import { useResourceManager } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, currencyIntlFormat, formatTime, gramToKg, TimeFormat } from "../../utils/utils";
import { RealmTransfer } from "./realm-transfer";

export const ResourceChip = ({
  isLabor = false,
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
    return resourceManager.timeUntilValueReached(useUIStore.getState().currentDefaultTick, 0);
  }, [resourceManager, production?.production_rate]);

  const netRate = useMemo(() => {
    let netRate = resourceManager.netRate();
    if (netRate[1] < 0) {
      // net rate is negative
      if (Math.abs(netRate[1]) > resourceManager.balance(useUIStore.getState().currentDefaultTick)) {
        return 0;
      }
    }
    return netRate[1];
  }, [resourceManager, production]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;

    let realTick = useUIStore.getState().currentDefaultTick;

    const resource = resourceManager.getResource();
    const [sign, rate] = resourceManager.netRate();

    const productionDuration = resourceManager.productionDuration(realTick);
    const depletionDuration = resourceManager.depletionDuration(realTick);

    const newBalance = resourceManager.balanceFromComponents(
      resourceId,
      rate,
      sign,
      resource?.balance,
      productionDuration,
      depletionDuration,
    );

    setBalance(newBalance);

    if (Math.abs(netRate) > 0) {
      const interval = setInterval(() => {
        realTick += 1;
        const localResource = resourceManager.getResource();
        const localProductionDuration = resourceManager.productionDuration(realTick);
        const localDepletionDuration = resourceManager.depletionDuration(realTick);

        const newBalance = resourceManager.balanceFromComponents(
          resourceId,
          rate,
          netRate > 0,
          localResource?.balance,
          localProductionDuration,
          localDepletionDuration,
        );

        setBalance(newBalance);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [setBalance, resourceManager, netRate, resourceId, production]);

  const isConsumingInputsWithoutOutput = useMemo(() => {
    if (!production?.production_rate) return false;
    return resourceManager.isConsumingInputsWithoutOutput(useUIStore.getState().currentDefaultTick);
  }, [resourceManager, production, entityId]);

  const icon = useMemo(
    () => (
      <ResourceIcon
        isLabor={isLabor}
        withTooltip={false}
        resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}
        size="sm"
        className="mr-3 self-center"
      />
    ),
    [resourceId],
  );

  const reachedMaxCap = useMemo(() => {
    return maxAmountStorable === balance && Math.abs(netRate) > 0;
  }, [maxAmountStorable, balance, netRate]);

  const timeUntilFinishTick = useMemo(() => {
    return resourceManager.timeUntilFinishTick(useUIStore.getState().currentDefaultTick);
  }, [resourceManager, production]);

  const isProducingOrConsuming = useMemo(() => {
    if (netRate > 0 && timeUntilFinishTick <= 0) return false;
    return Math.abs(netRate) > 0 && !reachedMaxCap && !isConsumingInputsWithoutOutput && balance > 0;
  }, [netRate, reachedMaxCap, isConsumingInputsWithoutOutput, balance, timeUntilFinishTick]);

  const handleMouseEnter = useCallback(() => {
    setTooltip({
      position: "top",
      content: <>{findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}</>,
    });
    setShowPerHour(false);
  }, [resourceId, isLabor, setTooltip]);

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
          <div className="self-center font-bold col-span-3">{currencyFormat(balance ? Number(balance) : 0, 0)}</div>

          <div className="self-center m-y-auto font-bold col-span-4 text-center">
            {timeUntilValueReached !== 0
              ? formatTime(timeUntilValueReached, TimeFormat.D | TimeFormat.H | TimeFormat.M)
              : ""}
          </div>

          {isProducingOrConsuming ? (
            <div
              className={`${
                Number(netRate) < 0 ? "text-light-red" : "text-green/80"
              } self-center px-2 flex font-bold text-[10px] col-span-3 text-center mx-auto`}
            >
              <div className={`self-center`}>
                {parseFloat(netRate.toString()) < 0 ? "" : "+"}
                {showPerHour
                  ? `${currencyIntlFormat(netRate * 3.6, 2)}/h`
                  : `${currencyIntlFormat(netRate / 1000, 2)}/s`}
              </div>
            </div>
          ) : (
            <div
              onMouseEnter={() => {
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      {isConsumingInputsWithoutOutput
                        ? "Production has stopped because inputs have been depleted"
                        : "Production has stopped because the max balance has been reached"}
                    </>
                  ),
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="self-center px-2 col-span-3 mx-auto"
            >
              {isConsumingInputsWithoutOutput || reachedMaxCap ? "⚠️" : ""}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
