import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  formatTime,
  getTotalResourceWeightKg,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { findResourceById, ID, TickIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  size = "default",
  hideZeroBalance = false,
  showTransfer = true,
  storageCapacity = 0,
  storageCapacityUsed = 0,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
  storageCapacity?: number;
  storageCapacityUsed?: number;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);
  const [amountProduced, setAmountProduced] = useState(0n);
  const [amountProducedLimited, setAmountProducedLimited] = useState(0n);
  const [hasReachedMaxCap, setHasReachedMaxCap] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  const actualBalance = useMemo(() => {
    return resourceManager.balance(resourceId);
  }, [resourceManager, currentTick]);

  useEffect(() => {
    setDisplayBalance(actualBalance ? Number(actualBalance) : 0);
  }, [actualBalance]);

  const production = useMemo(() => {
    if (currentTick === 0) return null;
    const { balance, hasReachedMaxCapacity, amountProduced, amountProducedLimited } =
      resourceManager.balanceWithProduction(currentTick, resourceId);
    setBalance(balance);
    setHasReachedMaxCap(hasReachedMaxCapacity);
    setAmountProduced(amountProduced);
    setAmountProducedLimited(amountProducedLimited);
    const resource = resourceManager.getResource();
    if (!resource) return null;
    return ResourceManager.balanceAndProduction(resource, resourceId).production;
  }, [resourceManager, currentTick, resourceId, hasReachedMaxCap, amountProducedLimited, amountProduced, balance]);

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  const productionRate = useMemo(() => {
    return Number(divideByPrecision(Number(production?.production_rate || 0), false));
  }, [production]);

  const productionEndsAt = useMemo(() => {
    return resourceManager.getProductionEndsAt(resourceId);
  }, [resourceManager]);

  const productionAmountRemaining = useMemo(() => {
    return Number(divideByPrecision(Number(production?.output_amount_left || 0), false));
  }, [production]);

  const isActive = useMemo(() => {
    return resourceManager.isActive(resourceId);
  }, [resourceManager]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    let realTick = currentTick;

    if (isActive && !hasReachedMaxCap) {
      const interval = setInterval(() => {
        realTick += 1;
        const { balance, hasReachedMaxCapacity } = resourceManager.balanceWithProduction(realTick, resourceId);

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
        className=" self-center"
      />
    );
  }, [resourceId, size]);

  const producedWeight = useMemo(() => {
    return getTotalResourceWeightKg([{ resourceId, amount: Number(amountProduced) }]);
  }, [amountProduced, resourceId]);

  const storageRemaining = useMemo(() => {
    return storageCapacity - storageCapacityUsed;
  }, [storageCapacity, storageCapacityUsed]);

  const isStorageFull = useMemo(() => {
    return storageRemaining <= 0;
  }, [storageRemaining]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const newDisplayBalance = Number(actualBalance || 0) + Number(amountProduced || 0n);
    setDisplayBalance(newDisplayBalance);

    setTooltip({
      position: "left",
      content: (
        <div className="space-y-1 max-w-72">
          <div>
            <span className="text-gold font-bold">Total available:</span>{" "}
            <span className="text-gold">{currencyFormat(newDisplayBalance, 2)}</span>{" "}
            {findResourceById(resourceId)?.trait}
          </div>
          {Number(amountProduced || 0n) > 0 && (
            <>
              <p>
                You have{" "}
                <span className={!isStorageFull ? "text-green" : "text-red"}>
                  {currencyFormat(Number(amountProduced || 0n), 2)}
                </span>{" "}
                {findResourceById(resourceId)?.trait} waiting to be stored.
              </p>
              <p>
                Whenever you use this resource (building, trading, pause, production, etc.) the produced amount is first
                moved into storage.
                <br />
                Only the portion that fits within your remaining capacity&nbsp;(
                <span className="text-green">
                  {storageRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}kg
                </span>
                ) will be saved; any excess&nbsp;(
                <span className="text-red">
                  of {divideByPrecision(producedWeight, false).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  kg
                </span>
                ) will be permanently burned.
              </p>
              <p>
                {
                  // Calculate the net result of claiming all produced weight against remaining storage.
                  storageRemaining - divideByPrecision(producedWeight, false) >= 0 ? (
                    <span className="text-green">All will fit if used right now.</span>
                  ) : (
                    <>
                      <span className="text-red">
                        {Math.abs(storageRemaining - divideByPrecision(producedWeight, false)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 0 },
                        )}
                        kg&nbsp;
                      </span>
                      will be burnt if you claim it all.
                    </>
                  )
                }
              </p>
            </>
          )}
        </div>
      ),
    });
  }, [
    actualBalance,
    amountProduced,
    resourceId,
    setTooltip,
    isStorageFull,
    storageRemaining,
    producedWeight,
    setIsHovered,
    setDisplayBalance,
  ]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltip(null);
    setShowPerHour(true);
    setDisplayBalance(actualBalance ? Number(actualBalance) : 0);
  }, [setTooltip, actualBalance, setShowPerHour, setIsHovered, setDisplayBalance]);

  const togglePopup = useUIStore((state) => state.togglePopup);

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  if (hideZeroBalance && balance <= 0) {
    return null;
  }

  return (
    <div
      className={`flex relative group items-center ${
        size === "large" ? "text-base px-3 p-2" : "text-sm px-2 p-1.5"
      } hover:bg-gold/5`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-wrap w-full items-center">
        <div className={`self-center flex flex-wrap w-full gap-2 ${size === "large" ? "text-lg" : ""}`}>
          <div className="flex items-center gap-2">
            {icon}
            <span className={`${isHovered ? "font-bold animate-pulse" : ""}`}>
              {currencyFormat(displayBalance, 2)}
            </span>{" "}
          </div>

          {amountProduced > 0n && (
            <div className={` flex  gap-2 self-start text-xs text-gold/50`}>
              [
              <span className={!isStorageFull ? "text-green" : "text-red"}>
                {currencyFormat(Number(amountProduced || 0n), 2)}
              </span>
              <div className="flex  gap-4 w-full col-span-12">
                {isActive &&
                !hasReachedMaxCap &&
                (productionEndsAt > currentTick || resourceManager.isFood(resourceId)) ? (
                  <div className={`self-center flex ${size === "large" ? "text-base" : "text-xs"} justify-end`}>
                    <div className={!isStorageFull ? "text-green" : "text-red"}>
                      +
                      {showPerHour
                        ? `${currencyIntlFormat(productionRate * 60 * 60, 4)}/h`
                        : `${currencyIntlFormat(productionRate, 4)}/s`}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`self-center col-span-5 text-right ${size === "large" ? "text-base" : "text-xs"} font-medium`}
                  >
                    {hasReachedMaxCap ? "Max" : ""}
                  </div>
                )}
              </div>
              ]
            </div>
          )}
        </div>

        {producedWeight > 0 && (
          <div className="text-xs text-gold/40 col-span-12 flex items-center">
            {divideByPrecision(Number(producedWeight || 0n), false).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            kg produced
          </div>
        )}

        <div className={`ml-2 text-xs text-gold/40  ${size === "large" ? "" : ""}`}>
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
