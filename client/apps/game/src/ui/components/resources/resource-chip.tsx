import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import { configManager, divideByPrecision, formatTime, ResourceManager } from "@bibliothecadao/eternum";
import { findResourceById, ID, TickIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  size = "default",
  hideZeroBalance = false,
  showTransfer = true,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);
  const [hasReachedMaxCap, setHasReachedMaxCap] = useState(false);

  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  const production = useMemo(() => {
    if (currentTick === 0) return null;
    const { balance, hasReachedMaxCapacity } = resourceManager.balanceWithProduction(currentTick, resourceId);
    setBalance(balance);
    setHasReachedMaxCap(hasReachedMaxCapacity);
    const resource = resourceManager.getResource();
    if (!resource) return null;
    return ResourceManager.balanceAndProduction(resource, resourceId).production;
  }, [resourceManager, currentTick]);

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

    const newBalance = resourceManager.balanceWithProduction(realTick, resourceId).balance;
    setBalance(newBalance);

    if (isActive && !hasReachedMaxCap) {
      const interval = setInterval(() => {
        realTick += 1;
        const { balance, hasReachedMaxCapacity } = resourceManager.balanceWithProduction(realTick, resourceId);
        setBalance(balance);
        setHasReachedMaxCap(hasReachedMaxCapacity);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [resourceManager, currentTick, isActive, hasReachedMaxCap]);

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
      className={`flex relative group items-center ${
        size === "large" ? "text-base px-3 p-2" : "text-sm px-2 p-1.5"
      } hover:bg-gold/20`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon}
      <div className="grid grid-cols-10 w-full items-center">
        <div className={`self-center font-bold col-span-5 ${size === "large" ? "text-lg" : ""}`}>
          {currencyFormat(balance ? Number(balance) : 0, 2)}
        </div>

        {isActive && !hasReachedMaxCap && (productionEndsAt > currentTick || resourceManager.isFood(resourceId)) ? (
          <div
            className={`${
              productionRate < 0 ? "text-light-red" : "text-green/60"
            } self-center px-2 flex font-bold ${size === "large" ? "text-lg" : "text-xs"} col-span-5 justify-end`}
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
                    {hasReachedMaxCap
                      ? "Production has stopped because the max balance has been reached"
                      : "Production has stopped because labor has been depleted"}
                  </>
                ),
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className={`self-center px-2 col-span-5 text-right ${
              size === "large" ? "text-base" : "text-xs"
            } font-medium`}
          >
            {hasReachedMaxCap ? "MaxCap" : ""}
          </div>
        )}

        <div className={`col-span-10 text-xs ${size === "large" ? "" : ""}`}>
          {timeUntilValueReached !== 0 ? formatTime(timeUntilValueReached) : ""}
        </div>
      </div>
      {showTransfer && (
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
      )}
    </div>
  );
};
