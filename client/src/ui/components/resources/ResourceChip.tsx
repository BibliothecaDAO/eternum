import { findResourceById, getIconResourceId, ID } from "@bibliothecadao/eternum";

import { configManager } from "@/dojo/setup";
import { useProductionManager } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, currencyIntlFormat, formatTime, gramToKg, TimeFormat } from "../../utils/utils";

const DISPLAY_RATE_TIME_MS = 5_000;
const TRANSITION_DURATION_MS = 400;

export const ResourceChip = ({
  isLabor = false,
  resourceId,
  entityId,
  maxStorehouseCapacityKg,
}: {
  isLabor?: boolean;
  resourceId: ID;
  entityId: ID;
  maxStorehouseCapacityKg: number;
}) => {
  const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
  const productionManager = useProductionManager(entityId, resourceId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const [showPerHour, setShowPerHour] = useState(true);
  const [displayedNetRate, setDisplayedNetRate] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const production = useMemo(() => {
    return productionManager.getProduction();
  }, [productionManager]);

  const balance = useMemo(() => {
    return productionManager.balance(currentDefaultTick);
  }, [productionManager, production, currentDefaultTick, maxStorehouseCapacityKg]);

  const maxAmountStorable = useMemo(() => {
    return maxStorehouseCapacityKg / gramToKg(configManager.getResourceWeight(resourceId) || 1000);
  }, [maxStorehouseCapacityKg, resourceId]);

  const timeUntilValueReached = useMemo(() => {
    return productionManager.timeUntilValueReached(currentDefaultTick, 0);
  }, [productionManager, production, currentDefaultTick]);

  const netRate = useMemo(() => {
    let netRate = productionManager.netRate(currentDefaultTick);
    if (netRate[1] < 0) {
      // net rate is negative
      if (Math.abs(netRate[1]) > productionManager.balance(currentDefaultTick)) {
        return 0;
      }
    }
    return netRate[1];
  }, [productionManager, production]);

  const isConsumingInputsWithoutOutput = useMemo(() => {
    if (!production?.production_rate) return false;
    return productionManager.isConsumingInputsWithoutOutput(currentDefaultTick);
  }, [productionManager, production, currentDefaultTick, entityId]);

  const [displayBalance, setDisplayBalance] = useState(balance);

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

  useEffect(() => {
    setDisplayBalance(balance);

    const interval = setInterval(() => {
      setDisplayBalance((prevDisplayBalance) => {
        if (Math.abs(netRate) > 0 && !isConsumingInputsWithoutOutput) {
          return Math.min(maxAmountStorable, Math.max(0, prevDisplayBalance + netRate));
        }
        return Math.min(maxAmountStorable, prevDisplayBalance);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [balance, netRate, entityId, maxAmountStorable]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPerHour((prev) => !prev);
    }, DISPLAY_RATE_TIME_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const newRate = showPerHour
      ? `${currencyIntlFormat(netRate * 3.6, 2)}/h`
      : `${currencyIntlFormat(netRate / 1000, 2)}/s`;
    if (newRate !== displayedNetRate) {
      setIsTransitioning(true);
      setTimeout(() => {
        setDisplayedNetRate(newRate);
        setIsTransitioning(false);
      }, TRANSITION_DURATION_MS / 2);
    }
  }, [netRate, showPerHour]);

  const reachedMaxCap = maxAmountStorable === displayBalance && Math.abs(netRate) > 0;

  return (
    <div
      className={`flex relative group items-center text-xs px-2 p-1 hover:bg-gold/20 `}
      onMouseEnter={() => {
        setTooltip({
          position: "top",
          content: <>{findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}</>,
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    >
      {icon}
      <div className="grid grid-cols-10 w-full">
        <div className="self-center font-bold col-span-3">
          {currencyFormat(displayBalance ? Number(displayBalance) : 0, 0)}
        </div>

        <div className="self-center m-y-auto font-bold col-span-4 text-center">
          {timeUntilValueReached !== 0
            ? formatTime(timeUntilValueReached, TimeFormat.D | TimeFormat.H | TimeFormat.M)
            : ""}
        </div>

        {netRate && !reachedMaxCap && !isConsumingInputsWithoutOutput && displayBalance > 0 ? (
          <div
            className={`${
              Number(netRate) < 0 ? "text-light-red" : "text-green/80"
            } self-center px-2 flex font-bold text-[10px] col-span-3 text-center mx-auto`}
          >
            <div
              className={`self-center transition-opacity duration-${TRANSITION_DURATION_MS} ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {parseFloat(netRate.toString()) < 0 ? "" : "+"}
              {displayedNetRate}
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
  );
};
