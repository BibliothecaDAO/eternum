import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Button } from "@/ui/design-system/atoms";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { DonkeyCostIndicator } from "./donkey-cost-indicator";
import { formatNumber, currencyFormat } from "@/ui/utils/utils";
import {
  MarketManager,
  divideByPrecision,
  multiplyByPrecision,
  calculateDonkeysNeeded,
  getTotalResourceWeightKg,
  getClosestBank,
  getBalance,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, findResourceById, ResourcesIds, ID } from "@bibliothecadao/types";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";

interface QuickSwapPopoverProps {
  entityId: ID;
  resourceId: ResourcesIds;
  onClose: () => void;
}

export const QuickSwapPopover = memo(({ entityId, resourceId, onClose }: QuickSwapPopoverProps) => {
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const popoverRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState(0);
  const [isBuying, setIsBuying] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const resourceName = findResourceById(resourceId)?.trait || "";

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // AMM price
  const marketManager = useMemo(
    () => new MarketManager(components, ContractAddress(account.address), resourceId),
    [components, resourceId, account.address],
  );
  const ammPrice = useMemo(() => marketManager?.getMarketPrice() || 0, [marketManager]);

  // Estimated lords cost/gain
  const estimatedLords = useMemo(() => {
    if (amount <= 0 || !ammPrice) return 0;
    return amount * ammPrice;
  }, [amount, ammPrice]);

  // Balances
  const lordsBalance = useMemo(
    () => getBalance(entityId, ResourcesIds.Lords, currentDefaultTick, components).balance,
    [entityId, currentDefaultTick, components],
  );
  const resourceBalance = useMemo(
    () => getBalance(entityId, resourceId, currentDefaultTick, components).balance,
    [entityId, resourceId, currentDefaultTick, components],
  );

  const lordsBalanceDisplay = divideByPrecision(lordsBalance);
  const resourceBalanceDisplay = divideByPrecision(resourceBalance);

  // Donkey cost
  const weightKg = useMemo(() => {
    if (amount <= 0) return 0;
    const transportedResourceId = isBuying ? resourceId : ResourcesIds.Lords;
    return getTotalResourceWeightKg([{ resourceId: transportedResourceId, amount }]);
  }, [amount, isBuying, resourceId]);

  const donkeysNeeded = useMemo(() => calculateDonkeysNeeded(weightKg), [weightKg]);

  const donkeyBalance = useMemo(
    () => divideByPrecision(getBalance(entityId, ResourcesIds.Donkey, currentDefaultTick, components).balance),
    [entityId, currentDefaultTick, components],
  );

  const canTransport = resourceId === ResourcesIds.Donkey || donkeyBalance >= donkeysNeeded;

  const hasEnough = useMemo(() => {
    if (amount <= 0) return false;
    if (isBuying) {
      return multiplyByPrecision(estimatedLords) <= lordsBalance;
    }
    return multiplyByPrecision(amount) <= resourceBalance;
  }, [amount, isBuying, estimatedLords, lordsBalance, resourceBalance]);

  const canSwap = amount > 0 && canTransport && hasEnough;

  const onSwap = useCallback(async () => {
    setIsLoading(true);
    try {
      const closestBank = getClosestBank(entityId, components);
      if (!closestBank) return;

      const precisionAmount = multiplyByPrecision(Number(amount.toFixed(2)));
      const operation = isBuying ? systemCalls.buy_resources : systemCalls.sell_resources;

      await operation({
        signer: account,
        bank_entity_id: closestBank.bankId,
        entity_id: entityId,
        resource_type: resourceId,
        amount: precisionAmount,
      });

      onClose();
    } catch (error) {
      console.error("Quick swap failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [amount, isBuying, entityId, resourceId, components, systemCalls, account, onClose]);

  const maxAmount = isBuying ? (ammPrice > 0 ? lordsBalanceDisplay / ammPrice : 0) : resourceBalanceDisplay;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 right-0 top-full mt-1 w-64 p-3 rounded-lg border border-gold/30 bg-brown/95 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Buy/Sell toggle */}
      <div className="flex rounded overflow-hidden border border-gold/20 mb-2">
        <button
          className={`flex-1 py-1 text-xs font-medium transition-colors ${
            isBuying ? "bg-green/20 text-green" : "text-gold/40 hover:text-gold/60"
          }`}
          onClick={() => setIsBuying(true)}
        >
          Buy
        </button>
        <button
          className={`flex-1 py-1 text-xs font-medium transition-colors ${
            !isBuying ? "bg-red/20 text-red" : "text-gold/40 hover:text-gold/60"
          }`}
          onClick={() => setIsBuying(false)}
        >
          Sell
        </button>
      </div>

      {/* Amount input */}
      <div className="mb-2">
        <NumberInput value={amount} onChange={(val) => setAmount(Number(val))} max={maxAmount} />
        <div className="flex justify-between mt-1 text-[10px] text-gold/40">
          <span>Bal: {currencyFormat(isBuying ? lordsBalanceDisplay : resourceBalanceDisplay, 0)}</span>
          <span>@ {formatNumber(ammPrice, 4)} Lords/{resourceName}</span>
        </div>
      </div>

      {/* Estimate */}
      {amount > 0 && (
        <div className="text-xs text-gold/60 mb-2 text-center">
          {isBuying ? "Cost" : "Gain"}: ~{currencyFormat(estimatedLords, 2)} Lords
        </div>
      )}

      {/* Donkey cost */}
      <div className="mb-2">
        <DonkeyCostIndicator donkeysNeeded={donkeysNeeded} donkeyBalance={donkeyBalance} canTransport={canTransport} />
      </div>

      {/* Swap button */}
      <Button
        variant="primary"
        size="xs"
        className="w-full"
        disabled={!canSwap}
        isLoading={isLoading}
        onClick={onSwap}
      >
        {isBuying ? "Buy" : "Sell"} {resourceName}
      </Button>
    </div>
  );
});

QuickSwapPopover.displayName = "QuickSwapPopover";
