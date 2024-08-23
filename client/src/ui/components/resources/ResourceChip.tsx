import { findResourceById, getIconResourceId, ID } from "@bibliothecadao/eternum";

import { useProductionManager } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, formatTime } from "../../utils/utils";

export const ResourceChip = ({
  isLabor = false,
  resourceId,
  entityId,
}: {
  isLabor?: boolean;
  resourceId: ID;
  entityId: ID;
}) => {
  const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
  const productionManager = useProductionManager(entityId, resourceId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const production = useMemo(() => {
    return productionManager.getProduction();
  }, [productionManager]);

  const balance = useMemo(() => {
    return productionManager.balance(currentDefaultTick);
  }, [productionManager, production, currentDefaultTick]);

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
        if (Math.abs(netRate) > 0) {
          return prevDisplayBalance + netRate;
        }
        return prevDisplayBalance;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [balance, netRate, entityId]);

  return (
    <div
      className={`flex relative group items-center text-xs px-2 p-1 hover:bg-gold/20  ${
        netRate && netRate < 0 ? "bg-red/5" : "bg-green/5"
      } `}
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
      <div className="flex justify-between w-full">
        <div className=" self-center text-sm font-bold">
          {currencyFormat(displayBalance ? Number(displayBalance) : 0, 0)}
        </div>

        <div className="font-bold">
          {timeUntilValueReached !== 0 ? formatTime(timeUntilValueReached) + " left" : ""}
        </div>

        {/* <div className="text-xs w-full self-center text-opacity-65 px-1">{findResourceById(resourceId)?.trait}</div> */}
        {netRate ? (
          <div
            className={`${Number(netRate) < 0 ? "text-light-red" : "text-green/80"} self-center px-2 flex font-bold`}
          >
            <div>{parseFloat(netRate.toString()) < 0 ? "" : "+"}</div>

            <div>{netRate / 1000} / s</div>
          </div>
        ) : (
          <div
            onMouseEnter={() => {
              setTooltip({
                position: "top",
                content: <>Production has stopped because inputs have been depleted</>,
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="self-center px-2"
          >
            {isConsumingInputsWithoutOutput ? "⚠️" : ""}
          </div>
        )}
      </div>
    </div>
  );
};
