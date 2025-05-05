import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  formatTime,
  ResourceManager
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { findResourceById, ID, TickIds } from "@bibliothecadao/types";
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
  const {
    setup: {
      account: { account },
      systemCalls: { harvest_production },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);
  const [unclaimedBalance, setUnclaimedBalance] = useState(0);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState<string | null>(null);
  const [rateDisplayMode, setRateDisplayMode] = useState<"hour" | "minute" | "second">("hour");
  const [forceRender, setForceRender] = useState(0);

  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  const getBalance = useCallback(() => {
    return resourceManager.actualBalance(currentTick, resourceId, false);
  }, [resourceManager, currentTick]);

  const getUnclaimedBalance = useCallback(() => {
    return resourceManager.producedBalance(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  const production = useMemo(() => {
    const balance = getBalance();
    const unclaimedBalance = getUnclaimedBalance();

    setBalance(balance);
    setUnclaimedBalance(unclaimedBalance);
    return resourceManager.getProduction(resourceId);
  }, [getBalance, resourceManager]);

  // const maxAmountStorable = useMemo(() => {
  //   return multiplyByPrecision(maxCapacityKg / configManager.getResourceWeightKg(resourceId));
  // }, [maxCapacityKg, resourceId]);

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  const productionRate = useMemo(() => {
    return Number(divideByPrecision(Number(production?.production_rate || 0), false));
  }, [production]);

  // Format rate based on selected display mode
  const formattedRate = useMemo(() => {
    let rate = 0;
    let unit = "";
    
    switch (rateDisplayMode) {
      case "hour":
        rate = productionRate * 60 * 60;
        unit = "/hour";
        break;
      case "minute":
        rate = productionRate * 60;
        unit = "/min";
        break;
      case "second":
        rate = productionRate;
        unit = "/sec";
        break;
    }
    
    return { 
      value: currencyIntlFormat(rate, rateDisplayMode === "second" ? 4 : 2),
      unit 
    };
  }, [productionRate, rateDisplayMode]);

  // Cycle through rate display modes
  const cycleRateDisplayMode = () => {
    setRateDisplayMode(prev => {
      switch (prev) {
        case "hour": return "minute";
        case "minute": return "second";
        case "second": return "hour";
        default: return "hour";
      }
    });
  };

  const productionEndsAt = useMemo(() => {
    return resourceManager.getProductionEndsAt(resourceId);
  }, [resourceManager]);

  const isActive = useMemo(() => {
    // Check if production has ended by comparing current tick with productionEndsAt
    if (!resourceManager.isFood(resourceId) && productionEndsAt > 0 && currentTick >= productionEndsAt) {
      return false;
    }
    return resourceManager.isActive(resourceId);
  }, [resourceManager, resourceId, currentTick, productionEndsAt, forceRender]);

  const hasUnclaimedBalance = useMemo(() => {
    return getUnclaimedBalance() > 0;
  }, [getUnclaimedBalance, resourceManager]);

  const isFood = useMemo(() => {
    return resourceManager.isFood(resourceId);
  }, [resourceManager, resourceId]);

  // Format time remaining into days::hours::minutes::seconds
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "00::00::00::00";
    
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${days.toString().padStart(2, '0')}::${hours.toString().padStart(2, '0')}::${minutes.toString().padStart(2, '0')}::${secs.toString().padStart(2, '0')}`;
  };

  // Update status when timer hits zero
  useEffect(() => {
    // Create an interval to check if production has ended
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    const interval = setInterval(() => {
      // Force re-render when production ends
      if (!resourceManager.isFood(resourceId) && 
          productionEndsAt > 0 && 
          currentTick >= productionEndsAt) {
        // This state update will trigger re-render
        setPulseAnimation(prev => !prev);
        setForceRender(prev => prev + 1); // Force a re-render when status changes
      }
    }, tickTime);
    
    return () => clearInterval(interval);
  }, [resourceManager, resourceId, currentTick, productionEndsAt]);

  // Pulse animation effect for status dot
  useEffect(() => {
    if (hasUnclaimedBalance) {
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev);
      }, isActive ? 1500 : 2000);
      return () => clearInterval(interval);
    }
  }, [hasUnclaimedBalance, isActive]);

  // Update countdown timer when modal is open
  useEffect(() => {
    if (!showResourceModal || isFood) return;

    const tickTime = configManager.getTick(TickIds.Default) * 1000; // convert to ms
    const ticksPerSecond = 1000 / tickTime;
    
    const updateCountdown = () => {
      const now = currentTick;
      if (productionEndsAt <= now || !isActive) {
        setCountdownTimer("00::00::00::00");
        return;
      }
      
      const ticksRemaining = productionEndsAt - now;
      const secondsRemaining = ticksRemaining / ticksPerSecond;
      setCountdownTimer(formatCountdown(secondsRemaining));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [showResourceModal, currentTick, productionEndsAt, isActive, isFood]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    let realTick = currentTick;

    const newBalance = resourceManager.actualBalance(realTick, resourceId);
    const newUnclaimedBalance = resourceManager.producedBalance(realTick, resourceId);
    setBalance(newBalance);
    setUnclaimedBalance(newUnclaimedBalance);

    if (isActive) {
      const interval = setInterval(() => {
        realTick += 1;
        const newBalance = resourceManager.actualBalance(realTick, resourceId);
        const newUnclaimedBalance = resourceManager.producedBalance(realTick, resourceId);
        setBalance(newBalance);
        setUnclaimedBalance(newUnclaimedBalance);
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

  // const reachedMaxCap = useMemo(() => {
  //   return maxAmountStorable <= balance;
  // }, [maxAmountStorable, balance]);

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
  
  const openResourceModal = () => {
    setShowResourceModal(true);
  };

  const closeResourceModal = () => {
    setShowResourceModal(false);
  };

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  if (hideZeroBalance && balance <= 0 && unclaimedBalance <= 0) {
    return null;
  }

  // Define colors for active and complete states
  const activeColor = "rgb(34, 197, 94)"; // Vibrant green
  const completeColor = "rgb(255, 145, 20)"; // Vibrant orange

  return (
    <>
      <div
        className={`flex relative group items-center ${
          size === "large" ? "text-base px-3 p-2" : "text-sm px-2 p-1.5"
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

          <div className="self-center col-span-3 flex justify-center items-center">
            {hasUnclaimedBalance && (
              <button
                onClick={openResourceModal}
                onMouseEnter={() => {
                  setTooltip({
                    position: "top",
                    content: <>{isActive ? "Click to Harvest" : "Click to Harvest"}</>,
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="relative w-4 h-4 rounded-full flex items-center justify-center 
                  transition-all duration-200 hover:opacity-90"
                style={{ 
                  background: isActive 
                    ? `radial-gradient(circle, ${activeColor} 40%, rgba(16,185,129,0.8) 90%)` 
                    : `radial-gradient(circle, ${completeColor} 40%, rgba(249,115,22,0.8) 90%)`,
                  boxShadow: `0 0 4px ${isActive ? activeColor : completeColor}`,
                }}
              >
                {pulseAnimation && (
                  <div 
                    className="absolute inset-0 rounded-full animate-ping opacity-60"
                    style={{
                      background: isActive ? activeColor : completeColor,
                      animationDuration: '1.5s',
                    }}
                  ></div>
                )}
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400/90 animate-ping opacity-75"></div>
                )}
              </button>
            )}
          </div>
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

      {/* Resource Modal */}
      {showResourceModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn"
          onClick={closeResourceModal}
        >
          <div 
            className="bg-black border border-gold/50 p-5 rounded-md w-96 animate-slideIn"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(20,20,20,0.9))'
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5 border-b border-gold/30 pb-3">
              <h3 className="text-gold text-lg font-bold flex items-center">
                <ResourceIcon
                  withTooltip={false}
                  resource={findResourceById(resourceId)?.trait as string}
                  size="md"
                  className="mr-2"
                />
                {findResourceById(resourceId)?.trait as string}
              </h3>
              <button 
                onClick={closeResourceModal}
                className="text-gold hover:text-white h-8 w-8 flex items-center justify-center rounded-full hover:bg-gold/20 transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Main Content */}
            <div className="space-y-5">
              {/* Resource Balance Section */}
              <div className="flex flex-col items-center">
                <div className="text-sm text-gold/80 uppercase tracking-wider mb-1">Current Balance</div>
                <div className="text-white text-3xl font-bold">
                  {currencyFormat(balance ? Number(balance) : 0, 2)}
                </div>
              </div>
              
              {/* Status Card */}
              <div className="bg-black/30 border border-gold/20 rounded-md p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-gray-300 text-sm">Status</span>
                  {isActive ? (
                    <div className="flex items-center mt-1">
                      <div className="w-3 h-3 rounded-full mr-2" style={{background: `radial-gradient(circle, ${activeColor} 30%, rgba(16,185,129,0.7) 100%)`}}></div>
                      <span style={{color: activeColor}} className="font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center mt-1">
                      <div className="w-3 h-3 rounded-full mr-2" style={{background: `radial-gradient(circle, ${completeColor} 30%, rgba(249,115,22,0.7) 100%)`}}></div>
                      <span style={{color: completeColor}} className="font-medium">Complete</span>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={cycleRateDisplayMode}
                  className="group relative"
                >
                  <div className="flex flex-col items-end transition-opacity duration-200">
                    <span className="text-gray-300 text-sm group-hover:opacity-80">Production Rate</span>
                    <div className="flex items-center mt-1 relative">
                      <span className={`${productionRate < 0 ? "text-light-red" : "text-green/80"} font-medium`}>
                        {formattedRate.value}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">{formattedRate.unit}</span>
                      
                      {/* Rate mode switcher indicator */}
                      <div className="absolute -right-5 flex space-x-0.5 items-center opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                        <div className={`w-1 h-1 rounded-full ${rateDisplayMode === "hour" ? "bg-gold" : "bg-gray-500"}`}></div>
                        <div className={`w-1 h-1 rounded-full ${rateDisplayMode === "minute" ? "bg-gold" : "bg-gray-500"}`}></div>
                        <div className={`w-1 h-1 rounded-full ${rateDisplayMode === "second" ? "bg-gold" : "bg-gray-500"}`}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover tooltip */}
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 -top-8 right-0 bg-black/90 text-xs text-gold/90 p-1 px-2 rounded border border-gold/20 whitespace-nowrap">
                    Click to toggle
                  </div>
                </button>
              </div>
              
              {/* Countdown Section */}
              {isActive && !isFood && (
                <div className="bg-black/30 border border-gold/20 rounded-md p-3">
                  <span className="text-gray-300 text-sm mb-2 block">Production Ends In</span>
                  <div className="bg-black/40 p-2 rounded border border-gold/30">
                    <div className="flex justify-center">
                      <div className="font-mono text-xl font-bold text-center" style={{color: activeColor}}>
                        {countdownTimer || "00::00::00::00"}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gold/70 pt-1 px-1">
                      <span>days</span>
                      <span>hours</span>
                      <span>mins</span>
                      <span>secs</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Infinite Production for Food */}
              {isFood && isActive && (
                <div className="bg-black/30 border border-gold/20 rounded-md p-3">
                  <span className="text-gray-300 text-sm mb-2 block">Production Duration</span>
                  <div className="bg-black/40 p-2 rounded border border-gold/30">
                    <div className="text-center text-gold italic text-lg">
                      ∞ Infinite ∞
                    </div>
                    <div className="text-xs text-center text-gold/70 pt-1">
                      Will produce indefinitely
                    </div>
                  </div>
                </div>
              )}
              
              {/* Harvest Section - Only show if there's something to claim */}
              {unclaimedBalance > 0 && (
                <div className="mt-5 p-4 bg-gradient-to-b from-gold/20 to-gold/5 rounded-md border border-gold/30">
                  <div className="flex flex-col items-center mb-3">
                    <div className="text-sm text-gold/90 uppercase tracking-wider mb-1">Available Harvest</div>
                    <div className="text-gold text-2xl font-bold">
                      {currencyFormat(unclaimedBalance, 2)}
                    </div>
                  </div>
                  
                  <button 
                    className="w-full py-3 border rounded-md font-bold transition-colors duration-200 
                      bg-gold/30 hover:bg-gold/40 text-white border-gold/70 shadow-lg shadow-gold/10"
                    onClick={async () => {
                      if (unclaimedBalance > 0) {
                        await harvest_production({
                          entity_id: resourceManager.entityId,
                          resource_type: resourceId,
                          allow_burn: false,
                          signer: account,
                        });
                        closeResourceModal();
                      }
                    }}
                  >
                    Harvest
                  </button>
                </div>
              )}
              
              {/* Empty Harvest Section */}
              {unclaimedBalance <= 0 && (
                <div className="mt-5 p-4 bg-gradient-to-b from-gray-800/20 to-gray-900/10 rounded-md border border-gray-700/30">
                  <div className="flex flex-col items-center mb-3">
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Nothing to Harvest</div>
                    <div className="text-gray-400 text-xl">0.00</div>
                  </div>
                  
                  <button 
                    className="w-full py-3 border rounded-md font-bold transition-colors duration-200 
                      bg-gray-800/50 text-gray-500 border-gray-700/50 cursor-not-allowed"
                    disabled
                  >
                    Nothing to Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
