import { useMarketStore } from "@/hooks/store/use-market-store";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { comparePrices } from "@/hooks/helpers/use-best-price";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ConfirmationPopup } from "@/ui/features/economy/banking";
import { formatNumber, currencyFormat } from "@/ui/utils/utils";
import {
  MarketManager,
  divideByPrecision,
  multiplyByPrecision,
  calculateDonkeysNeeded,
  getTotalResourceWeightKg,
  getClosestBank,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { findResourceById, ResourcesIds, ID, MarketInterface } from "@bibliothecadao/types";
import { memo, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { BuySellToggle } from "./buy-sell-toggle";
import { VenueComparison } from "./venue-comparison";
import { OrderBookDepth } from "./order-book-depth";
import { DonkeyCostIndicator } from "./donkey-cost-indicator";

const LiquidityTable = lazy(() =>
  import("@/ui/features/economy/banking").then((module) => ({
    default: module.LiquidityTable,
  })),
);

interface UnifiedTradePanelProps {
  resourceId: ResourcesIds;
  entityId: ID;
  askOffers: MarketInterface[];
  bidOffers: MarketInterface[];
}

export const UnifiedTradePanel = memo(({ resourceId, entityId, askOffers, bidOffers }: UnifiedTradePanelProps) => {
  const dojo = useDojo();
  const currentDefaultTick = useCurrentDefaultTick();
  const resourceManager = useResourceManager(entityId);

  const tradeDirection = useMarketStore((state) => state.tradeDirection);
  const tradeAmount = useMarketStore((state) => state.tradeAmount);
  const setTradeAmount = useMarketStore((state) => state.setTradeAmount);
  const selectedVenue = useMarketStore((state) => state.selectedVenue);

  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPools, setShowPools] = useState(false);

  const resourceName = findResourceById(resourceId)?.trait || "";

  // Get AMM price
  const marketManager = useMemo(
    () => new MarketManager(dojo.setup.components, 0n, resourceId),
    [dojo.setup.components, resourceId],
  );
  const ammSpotPrice = useMemo(() => marketManager?.getMarketPrice() || 0, [marketManager]);
  const ammSlippage = useMemo(() => {
    if (tradeAmount <= 0 || !marketManager) return 0;
    return marketManager.slippage(tradeAmount, tradeDirection === "buy") || 0;
  }, [marketManager, tradeAmount, tradeDirection]);

  // Compare prices across venues
  const bestPriceResult = useMemo(
    () =>
      comparePrices({
        direction: tradeDirection,
        askOffers,
        bidOffers,
        resourceId,
        ammSpotPrice: ammSpotPrice > 0 ? ammSpotPrice : null,
        ammSlippage,
      }),
    [tradeDirection, askOffers, bidOffers, resourceId, ammSpotPrice, ammSlippage],
  );

  // Determine effective price based on venue selection
  const effectivePrice = useMemo(() => {
    if (selectedVenue === "orderbook") return bestPriceResult.obPrice;
    if (selectedVenue === "amm") return bestPriceResult.ammPrice;
    // "best" - use whichever venue is recommended
    if (bestPriceResult.bestVenue === "orderbook") return bestPriceResult.obPrice;
    if (bestPriceResult.bestVenue === "amm") return bestPriceResult.ammPrice;
    return null;
  }, [selectedVenue, bestPriceResult]);

  const effectiveVenue = useMemo(() => {
    if (selectedVenue === "orderbook") return "orderbook";
    if (selectedVenue === "amm") return "amm";
    return bestPriceResult.bestVenue;
  }, [selectedVenue, bestPriceResult]);

  // Calculate total Lords cost/gain
  const totalLords = useMemo(() => {
    if (!effectivePrice || tradeAmount <= 0) return 0;
    return tradeAmount * effectivePrice;
  }, [effectivePrice, tradeAmount]);

  // Balance checks
  const lordsBalance = useMemo(
    () => divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords).balance),
    [resourceManager, currentDefaultTick],
  );
  const resourceBalance = useMemo(
    () => divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance),
    [resourceManager, currentDefaultTick, resourceId],
  );

  // Donkey calculations
  const weightKg = useMemo(() => {
    if (tradeAmount <= 0) return 0;
    const transportedResourceId = tradeDirection === "buy" ? ResourcesIds.Lords : resourceId;
    return getTotalResourceWeightKg([{ resourceId: transportedResourceId, amount: tradeAmount }]);
  }, [tradeAmount, tradeDirection, resourceId]);

  const donkeysNeeded = useMemo(() => calculateDonkeysNeeded(weightKg), [weightKg]);
  const donkeyBalance = useMemo(
    () => divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance),
    [resourceManager, currentDefaultTick],
  );
  const canTransport = resourceId === ResourcesIds.Donkey || donkeyBalance >= donkeysNeeded;

  // Validation
  const canExecute = useMemo(() => {
    if (tradeAmount <= 0) return false;
    if (!effectivePrice || !effectiveVenue) return false;
    if (!canTransport) return false;
    if (tradeDirection === "buy" && totalLords > lordsBalance) return false;
    if (tradeDirection === "sell" && tradeAmount > resourceBalance) return false;
    return true;
  }, [
    tradeAmount,
    effectivePrice,
    effectiveVenue,
    canTransport,
    tradeDirection,
    totalLords,
    lordsBalance,
    resourceBalance,
  ]);

  // Find the best OB offer for execution
  const bestOBOffer = useMemo(() => {
    if (tradeDirection === "buy") {
      return (
        askOffers.filter((o) => o.takerGets[0]?.resourceId === resourceId).sort((a, b) => a.perLords - b.perLords)[0] ||
        null
      );
    } else {
      return (
        bidOffers.filter((o) => o.makerGets[0]?.resourceId === resourceId).sort((a, b) => b.perLords - a.perLords)[0] ||
        null
      );
    }
  }, [tradeDirection, askOffers, bidOffers, resourceId]);

  const onExecute = useCallback(async () => {
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      if (effectiveVenue === "orderbook" && bestOBOffer) {
        // Accept the best order book offer
        const precisionAmount = multiplyByPrecision(tradeAmount);
        await dojo.setup.systemCalls.accept_order({
          signer: dojo.account.account,
          taker_id: entityId,
          trade_id: bestOBOffer.tradeId,
          taker_buys_count: Math.ceil(precisionAmount / bestOBOffer.makerGivesMinResourceAmount),
        });
      } else if (effectiveVenue === "amm") {
        // Execute AMM swap
        const closestBank = getClosestBank(entityId, dojo.setup.components);
        if (!closestBank) return;
        const precisionAmount = multiplyByPrecision(tradeAmount);
        if (tradeDirection === "buy") {
          await dojo.setup.systemCalls.buy_resources({
            signer: dojo.account.account,
            bank_entity_id: closestBank.bankId,
            entity_id: entityId,
            resource_type: resourceId,
            amount: precisionAmount,
          });
        } else {
          await dojo.setup.systemCalls.sell_resources({
            signer: dojo.account.account,
            bank_entity_id: closestBank.bankId,
            entity_id: entityId,
            resource_type: resourceId,
            amount: precisionAmount,
          });
        }
      }
    } catch (error) {
      console.error("Trade execution failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveVenue, bestOBOffer, tradeAmount, tradeDirection, entityId, resourceId, dojo]);

  const maxAmount = tradeDirection === "buy" ? (effectivePrice ? lordsBalance / effectivePrice : 0) : resourceBalance;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {/* Buy/Sell Toggle */}
      <BuySellToggle />

      {/* Amount Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-gold/50 uppercase mb-1">
              {tradeDirection === "buy" ? "Buy Amount" : "Sell Amount"}
            </div>
            <NumberInput
              value={tradeAmount}
              onChange={(val) => setTradeAmount(Number(val))}
              max={maxAmount}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-1.5 pt-4">
            <ResourceIcon resource={resourceName} size="md" withTooltip={false} />
            <span className="text-sm text-gold/70">{resourceName}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gold/50">
            Balance: {currencyFormat(tradeDirection === "buy" ? lordsBalance : resourceBalance, 0)}{" "}
            {tradeDirection === "buy" ? "Lords" : resourceName}
          </div>
          <DonkeyCostIndicator
            donkeysNeeded={donkeysNeeded}
            donkeyBalance={donkeyBalance}
            canTransport={canTransport}
          />
        </div>
      </div>

      {/* Price Summary */}
      {effectivePrice && tradeAmount > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gold/5 border border-gold/10">
          <span className="text-sm text-gold/60">
            @ {formatNumber(effectivePrice, 4)} Lords/{resourceName}
          </span>
          <span className={`text-sm font-medium ${tradeDirection === "buy" ? "text-red" : "text-green"}`}>
            {tradeDirection === "buy" ? "Cost" : "Gain"}: {currencyFormat(totalLords, 2)} Lords
          </span>
        </div>
      )}

      {/* Venue Comparison */}
      <VenueComparison bestPriceResult={bestPriceResult} resourceId={resourceId} />

      {/* Execute Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!canExecute}
        isLoading={isLoading}
        onClick={() => setShowConfirmation(true)}
      >
        {tradeDirection === "buy" ? "Buy" : "Sell"} {tradeAmount > 0 ? currencyFormat(tradeAmount, 0) : ""}{" "}
        {resourceName}
        {totalLords > 0 ? ` for ~${currencyFormat(totalLords, 0)} Lords` : ""}
      </Button>

      {/* Order Book Depth (collapsible) */}
      <OrderBookDepth askOffers={askOffers} bidOffers={bidOffers} resourceId={resourceId} entityId={entityId} />

      {/* Liquidity Pools toggle */}
      <button
        onClick={() => setShowPools(!showPools)}
        className="text-xs text-gold/40 hover:text-gold/60 transition-colors text-left"
      >
        {showPools ? "Hide" : "Show"} Liquidity Pools
      </button>
      {showPools && (
        <Suspense fallback={<LoadingAnimation />}>
          <LiquidityTable entity_id={entityId} />
        </Suspense>
      )}

      {/* Confirmation Popup */}
      {showConfirmation && (
        <ConfirmationPopup
          title={`Confirm ${tradeDirection === "buy" ? "Buy" : "Sell"}`}
          onConfirm={onExecute}
          onCancel={() => setShowConfirmation(false)}
          isLoading={isLoading}
        >
          <div className="p-4 text-center">
            <p className="mb-2">
              <span className={tradeDirection === "buy" ? "text-green" : "text-red"}>
                {tradeDirection === "buy" ? "Buy" : "Sell"}
              </span>{" "}
              {currencyFormat(tradeAmount, 0)} {resourceName}
            </p>
            <p className="mb-2">
              {tradeDirection === "buy" ? "Cost" : "Gain"}: ~{currencyFormat(totalLords, 2)} Lords
            </p>
            <p className="text-xs text-gold/50">
              via {effectiveVenue === "orderbook" ? "Order Book" : "AMM"}
              {effectiveVenue === "amm" && ammSlippage > 0 && ` (${formatNumber(ammSlippage, 2)}% slippage)`}
            </p>
            {!canTransport && <p className="mt-2 text-red text-sm">Not enough donkeys for transport!</p>}
          </div>
        </ConfirmationPopup>
      )}
    </div>
  );
});

UnifiedTradePanel.displayName = "UnifiedTradePanel";
