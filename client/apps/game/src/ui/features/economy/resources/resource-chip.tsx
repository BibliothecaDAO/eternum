import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  formatTime,
  getIsBlitz,
  getTotalResourceWeightKg,
  isRelic as isResourceRelic,
  relicsArmiesTicksLeft,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { ID, RelicEffectWithEndTick, RelicRecipientType, ResourcesIds, TickIds } from "@bibliothecadao/types";
import { Factory, Sparkles } from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  size = "default",
  hideZeroBalance = false,
  showTransfer = true,
  storageCapacity = 0,
  storageCapacityUsed = 0,
  activeRelicEffects,
  canOpenProduction = false,
  disableButtons = false,
  onManageProduction,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
  storageCapacity?: number;
  storageCapacityUsed?: number;
  activeRelicEffects: RelicEffectWithEndTick[];
  canOpenProduction?: boolean;
  disableButtons?: boolean;
  onManageProduction?: (resourceId: ResourcesIds) => void;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);
  const [amountProduced, setAmountProduced] = useState(0n);
  const [amountProducedLimited, setAmountProducedLimited] = useState(0n);
  const [hasReachedMaxCap, setHasReachedMaxCap] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const { currentDefaultTick, currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const currentTick = currentDefaultTick || 0;
  const resourceEnumId = resourceId as ResourcesIds;

  const actualBalance = useMemo(() => {
    return resourceManager.balance(resourceId);
  }, [resourceManager, resourceId, currentTick]);

  // Always show actual + produced (was previously only on hover)
  useEffect(() => {
    setDisplayBalance(Number(actualBalance || 0) + Number(amountProduced || 0n));
  }, [actualBalance, amountProduced]);

  useEffect(() => {
    if (currentTick === 0) return;

    const { balance, hasReachedMaxCapacity, amountProduced, amountProducedLimited } =
      resourceManager.balanceWithProduction(currentTick, resourceEnumId);

    setBalance(balance);
    setHasReachedMaxCap(hasReachedMaxCapacity);
    setAmountProduced(amountProduced);
    setAmountProducedLimited(amountProducedLimited);
  }, [resourceManager, resourceEnumId, currentTick]);

  const productionInfo = useMemo(() => {
    const resourceComponent = resourceManager.getResource();
    if (!resourceComponent) return null;

    return ResourceManager.balanceAndProduction(resourceComponent, resourceEnumId);
  }, [resourceManager, resourceEnumId, currentTick]);

  const productionData = useMemo(() => {
    if (!productionInfo) return null;

    return ResourceManager.calculateResourceProductionData(resourceEnumId, productionInfo, currentTick);
  }, [productionInfo, resourceEnumId, currentTick]);

  const productionRate = productionData?.productionPerSecond ?? 0;
  const isProducing = productionData?.isProducing ?? false;

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    let realTick = currentTick;

    if (isProducing && !hasReachedMaxCap) {
      const interval = setInterval(() => {
        realTick += 1;
        const { hasReachedMaxCapacity } = resourceManager.balanceWithProduction(realTick, resourceEnumId);

        setHasReachedMaxCap(hasReachedMaxCapacity);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [resourceManager, resourceEnumId, currentTick, isProducing, hasReachedMaxCap]);

  const icon = useMemo(() => {
    return (
      <ResourceIcon
        withTooltip={false}
        resource={ResourcesIds[resourceId]}
        size={size === "large" ? "md" : "sm"}
        className=" self-center"
      />
    );
  }, [resourceId, size]);

  const producedWeight = useMemo(() => {
    return getTotalResourceWeightKg([{ resourceId, amount: Number(amountProduced) }]);
  }, [amountProduced, resourceId]);

  const handleMouseEnter = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      setIsHovered(true);
      // const newDisplayBalance = Number(actualBalance || 0) + Number(amountProduced || 0n);
      // setDisplayBalance(newDisplayBalance);

      // setTooltip({
      //   anchorElement: event.currentTarget,
      //   position: "left",
      //   content: (
      //     <div className="space-y-1 max-w-72">
      //       <div>
      //         <span className="text-gold font-bold">Total available:</span>{" "}
      //         <span className="text-gold">{currencyFormat(newDisplayBalance, 2)}</span>{" "}
      //         {findResourceById(resourceId)?.trait}
      //       </div>
      //       {Number(amountProduced || 0n) > 0 && (
      //         <>
      //           <p>
      //             You have{" "}
      //             <span className={!isStorageFull ? "text-green" : "text-red"}>
      //               {currencyFormat(Number(amountProduced || 0n), 2)}
      //             </span>{" "}
      //             {findResourceById(resourceId)?.trait} waiting to be stored.
      //           </p>
      //           <p>
      //             Whenever you use this resource (building, trading, pause, production, etc.) the produced amount is
      //             first moved into storage.
      //             <br />
      //             Only the portion that fits within your remaining capacity&nbsp;(
      //             <span className="text-green">
      //               {storageRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}kg
      //             </span>
      //             ) will be saved; any excess&nbsp;(
      //             <span className="text-red">
      //               of{" "}
      //               {divideByPrecision(producedWeight, false).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      //               kg
      //             </span>
      //             ) will be permanently burned.
      //           </p>
      //           <p>
      //             {
      //               // Calculate the net result of claiming all produced weight against remaining storage.
      //               storageRemaining - divideByPrecision(producedWeight, false) >= 0 ? (
      //                 <span className="text-green">All will fit if used right now.</span>
      //               ) : (
      //                 <>
      //                   <span className="text-red">
      //                     {Math.abs(storageRemaining - divideByPrecision(producedWeight, false)).toLocaleString(
      //                       undefined,
      //                       { maximumFractionDigits: 0 },
      //                     )}
      //                     kg&nbsp;
      //                   </span>
      //                   will be burnt if you claim it all.
      //                 </>
      //               )
      //             }
      //           </p>
      //         </>
      //       )}
      //     </div>
      //   ),
      // });
    },
    [actualBalance, amountProduced, resourceId, setTooltip, producedWeight, setIsHovered, setDisplayBalance],
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltip(null);
    setShowPerHour(true);
    // setDisplayBalance(actualBalance ? Number(actualBalance) : 0);
  }, [setTooltip, actualBalance, setShowPerHour, setIsHovered, setDisplayBalance]);

  const togglePopup = useUIStore((state) => state.togglePopup);

  const canShowProductionShortcut = useMemo(() => {
    if (!canOpenProduction) return false;
    if (!resourceId && resourceId !== 0) return false;
    if (!getIsBlitz()) return true;
    return resourceId !== ResourcesIds.Labor && resourceId !== ResourcesIds.Wheat;
  }, [canOpenProduction, resourceId]);

  const handleOpenProduction = useCallback(() => {
    if (!canShowProductionShortcut) return;

    if (onManageProduction) {
      onManageProduction(resourceId as ResourcesIds);
      return;
    }

    if (!resourceManager?.entityId) return;
    setStructureEntityId(resourceManager.entityId);
    toggleModal(<ProductionModal preSelectedResource={resourceId as ResourcesIds} />);
  }, [canShowProductionShortcut, onManageProduction, resourceManager, resourceId, setStructureEntityId, toggleModal]);

  // Check if this resource is a relic
  const isRelic = useMemo(() => {
    // Using type assertion until the build system picks up the new method
    return isResourceRelic(resourceId);
  }, [resourceManager, resourceId]);

  // todo: check relic effect active
  const relicEffectActivated = useMemo(() => {
    return activeRelicEffects.some(
      (relicEffect) => relicEffect.id === resourceId && relicEffect.endTick > currentArmiesTick,
    );
  }, [resourceManager, resourceId, currentArmiesTick]);

  // Calculate time remaining for active relic with real-time countdown
  const relicTimeRemaining = useMemo(() => {
    if (!isRelic || !relicEffectActivated) return 0;

    // Get the relic effect data to access end_tick
    const relicEffect = activeRelicEffects.find((relicEffect) => relicEffect.id === resourceId);
    if (!relicEffect) return 0;

    // Calculate remaining ticks until effect ends
    const remainingTicks = relicsArmiesTicksLeft(relicEffect.endTick, currentArmiesTick);

    // Get tick interval for armies (relics use army ticks)
    const armyTickInterval = configManager.getTick(TickIds.Armies) || 1;

    // Calculate total remaining time: (full remaining ticks * tick duration) + time left in current tick
    // Only add current tick time remaining if there are remaining ticks
    const remainingSeconds = remainingTicks > 0 ? remainingTicks * armyTickInterval + armiesTickTimeRemaining : 0;

    return Math.max(0, remainingSeconds);
  }, [isRelic, relicEffectActivated, resourceManager, resourceId, currentArmiesTick, armiesTickTimeRemaining]);

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  // Show relics with active effects even if balance is 0
  if (hideZeroBalance && balance <= 0 && !(isRelic && relicEffectActivated)) {
    return null;
  }
  return (
    <div
      data-tooltip-anchor
      className={`flex relative group items-center ${
        size === "large" ? "text-base px-3 p-2" : "text-sm px-2 p-1.5"
      } hover:bg-gold/5 ${
        relicEffectActivated ? "bg-purple-500/20 border border-purple-500/50 rounded-lg animate-pulse" : ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-wrap w-full items-center">
        <div className={`self-center flex flex-wrap w-full gap-2 ${size === "large" ? "text-lg" : ""}`}>
          <div className="flex items-center gap-2">
            {icon}
            <span
              className={`${isHovered ? "font-bold animate-pulse" : ""} ${
                relicEffectActivated ? "text-relic font-semibold" : ""
              }`}
            >
              {currencyFormat(displayBalance, 2)}
            </span>{" "}
            {relicEffectActivated && (
              <div className="flex items-center ml-1 gap-1">
                <Sparkles className="h-3 w-3 text-relic2 animate-pulse" />
                <span
                  className="text-xs text-relic2 font-medium"
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setTooltip({
                      anchorElement: e.currentTarget,
                      position: "top",
                      content: (
                        <span className="text-sm">Relic effect expires in {formatTime(relicTimeRemaining)}</span>
                      ),
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setTooltip(null);
                  }}
                >
                  {formatTime(relicTimeRemaining)}
                </span>
              </div>
            )}
          </div>

          {amountProduced > 0n && (
            <div className={` flex  gap-2 self-start text-xs text-gold/50`}>
              [
              {/* <span className={!isStorageFull ? "text-green" : "text-red"}>
                {currencyFormat(Number(amountProduced || 0n), 2)}
              </span> */}
              <div className="flex  gap-4 w-full col-span-12">
                {isProducing && !hasReachedMaxCap ? (
                  <div className={`self-center flex ${size === "large" ? "text-base" : "text-xs"} justify-end`}>
                    <div className="text-green">
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

        {/* {producedWeight > 0 && (
          <div className="text-xs text-gold/40 col-span-12 flex items-center">
            {divideByPrecision(Number(producedWeight || 0n), false).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            kg produced
          </div>
        )} */}

        <div className={`ml-2 text-xs text-gold/40  ${size === "large" ? "" : ""}`}>
          {timeUntilValueReached > 1000000000
            ? "∞"
            : timeUntilValueReached !== 0
              ? formatTime(timeUntilValueReached)
              : ""}
        </div>
      </div>
      {canShowProductionShortcut && (
        <button
          data-tooltip-anchor
          onClick={(event) => {
            event.stopPropagation();
            handleOpenProduction();
          }}
          onMouseEnter={(event) =>
            setTooltip({
              anchorElement: event.currentTarget,
              content: "Manage Production",
              position: "bottom",
            })
          }
          onMouseLeave={() => setTooltip(null)}
          disabled={disableButtons}
          className="ml-2 p-1 hover:bg-gold/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Factory className={`${size === "large" ? "h-6 w-6" : "h-5 w-5"} text-gold`} />
        </button>
      )}
      {showTransfer && (
        <button
          data-tooltip-anchor
          onClick={(event) => {
            event.stopPropagation();
            togglePopup(resourceId.toString());
          }}
          disabled={disableButtons}
          className="ml-2 p-1 hover:bg-gold/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
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
      {isRelic && balance > 0 && (
        <button
          data-tooltip-anchor
          onClick={(event) => {
            event.stopPropagation();
            import("./relic-activation-popup").then(({ RelicActivationPopup }) => {
              toggleModal(
                <RelicActivationPopup
                  entityId={resourceManager.entityId}
                  entityOwnerId={resourceManager.entityId}
                  recipientType={RelicRecipientType.Structure}
                  relicId={resourceId}
                  relicBalance={divideByPrecision(balance)}
                  onClose={() => toggleModal(null)}
                />,
              );
            });
          }}
          disabled={disableButtons || relicTimeRemaining > 0}
          onMouseEnter={(event) =>
            setTooltip({
              anchorElement: event.currentTarget,
              content: "Activate Relic",
              position: "bottom",
            })
          }
          onMouseLeave={() => setTooltip(null)}
          className="ml-2 p-1 hover:bg-gold/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className={`${size === "large" ? "h-6 w-6" : "h-5 w-5"} text-gold`} />
        </button>
      )}
    </div>
  );
};
