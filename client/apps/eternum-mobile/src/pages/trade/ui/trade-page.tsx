import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SwapInput } from "@/widgets/swap-input";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getClosestBank,
  MarketManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { ContractAddress, resources, ResourcesIds } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { ArrowDownUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SwapConfirmDrawer } from "./swap-confirm-drawer";

export const TradePage = () => {
  const [searchParams] = useSearchParams();
  const [buyAmount, setBuyAmount] = useState(0);
  const [sellAmount, setSellAmount] = useState(0);
  const [buyResourceId, setBuyResourceId] = useState(ResourcesIds.Lords); // Default to Lords
  const [sellResourceId, setSellResourceId] = useState(1); // Default to first non-Lords resource
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { structureEntityId } = useStore();

  useEffect(() => {
    const parseSearchInt = (value: string | null) => {
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const buyResourceParam = parseSearchInt(searchParams.get("buyResourceId"));
    const sellResourceParam = parseSearchInt(searchParams.get("sellResourceId"));

    // Handle buy resource ID from URL
    if (buyResourceParam !== undefined) {
      const buyId = buyResourceParam;
      if (!isNaN(buyId)) {
        setBuyResourceId(buyId);
      }
    }

    // Handle sell resource ID from URL
    if (sellResourceParam !== undefined) {
      const sellId = sellResourceParam;
      if (!isNaN(sellId)) {
        setSellResourceId(sellId);
      }
    }

    // If both are set to the same resource, adjust one of them
    if (buyResourceParam !== undefined && sellResourceParam !== undefined && buyResourceParam === sellResourceParam) {
      // If both are Lords, set sell to another resource
      if (buyResourceParam === ResourcesIds.Lords) {
        setSellResourceId(1); // First non-Lords resource
      } else {
        // Otherwise set buy to Lords
        setBuyResourceId(ResourcesIds.Lords);
      }
    }

    // If only one is set, set the other to a complementary value
    if (buyResourceParam !== undefined && sellResourceParam === undefined) {
      const buyId = buyResourceParam;
      if (buyId === ResourcesIds.Lords) {
        setSellResourceId(1); // First non-Lords resource
      } else {
        setSellResourceId(ResourcesIds.Lords);
      }
    }

    if (buyResourceParam === undefined && sellResourceParam !== undefined) {
      const sellId = sellResourceParam;
      if (sellId === ResourcesIds.Lords) {
        setBuyResourceId(1); // First non-Lords resource
      } else {
        setBuyResourceId(ResourcesIds.Lords);
      }
    }
  }, [searchParams]);

  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const marketManager = useMemo(
    () =>
      new MarketManager(
        components,
        ContractAddress(account.address),
        sellResourceId === ResourcesIds.Lords ? buyResourceId : sellResourceId,
      ),
    [components, sellResourceId, buyResourceId, account.address],
  );

  const ownerFee = sellAmount * configManager.getAdminBankOwnerFee();
  const lpFee = sellAmount * configManager.getAdminBankLpFee();

  const sellBalance = useMemo(
    () => getBalance(structureEntityId, sellResourceId, currentDefaultTick, components).balance,
    [structureEntityId, sellResourceId, currentDefaultTick],
  );

  const hasEnough = useMemo(() => {
    return multiplyByPrecision(sellAmount) <= sellBalance;
  }, [sellAmount, sellBalance]);

  useEffect(() => {
    // Recalculate amounts when resource IDs change
    if (sellAmount > 0) {
      const newSellAmount = Math.min(sellAmount, divideByPrecision(sellBalance));
      handleSellAmountChange(newSellAmount);
    }
  }, [sellResourceId, buyResourceId]);

  const handleSwap = () => {
    const tempResourceId = buyResourceId;
    setBuyResourceId(sellResourceId);
    setSellResourceId(tempResourceId);

    const tempAmount = buyAmount;
    setBuyAmount(sellAmount);
    setSellAmount(tempAmount);
  };

  const handleSellAmountChange = (amount: number) => {
    setSellAmount(amount);
    if (sellResourceId === ResourcesIds.Lords) {
      // If selling Lords, calculate resource output
      const calculatedBuyAmount = divideByPrecision(
        marketManager.calculateResourceOutputForLordsInput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setBuyAmount(calculatedBuyAmount);
    } else {
      // If selling resources, calculate Lords output
      const calculatedBuyAmount = divideByPrecision(
        marketManager.calculateLordsOutputForResourceInput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setBuyAmount(calculatedBuyAmount * (1 - configManager.getAdminBankOwnerFee()));
    }
  };

  const handleBuyAmountChange = (amount: number) => {
    setBuyAmount(amount);
    if (sellResourceId === ResourcesIds.Lords) {
      // If selling Lords, calculate resource input needed
      const calculatedSellAmount = divideByPrecision(
        marketManager.calculateLordsInputForResourceOutput(
          multiplyByPrecision(amount) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setSellAmount(calculatedSellAmount);
    } else {
      // If selling resources, calculate Lords input needed
      const calculatedSellAmount = divideByPrecision(
        marketManager.calculateResourceInputForLordsOutput(
          multiplyByPrecision(amount / (1 - configManager.getAdminBankOwnerFee())) || 0,
          configManager.getBankConfig().lpFeesNumerator,
        ),
      );
      setSellAmount(calculatedSellAmount);
    }
  };

  const handleSellResourceChange = (newResourceId: number) => {
    if (newResourceId === buyResourceId) {
      // If the new sell resource matches buy resource, swap them
      setBuyResourceId(sellResourceId);
    } else if (newResourceId === ResourcesIds.Lords) {
      // If changing to Lords, make sure buy resource is not Lords
      if (buyResourceId === ResourcesIds.Lords) {
        setBuyResourceId(sellResourceId);
      }
    } else if (buyResourceId !== ResourcesIds.Lords) {
      // If neither would be Lords, set buy to Lords
      setBuyResourceId(ResourcesIds.Lords);
    }
    setSellResourceId(newResourceId);
    // Reset amounts when changing resources
    setBuyAmount(0);
    setSellAmount(0);
  };

  const handleBuyResourceChange = (newResourceId: number) => {
    if (newResourceId === sellResourceId) {
      // If the new buy resource matches sell resource, swap them
      setSellResourceId(buyResourceId);
    } else if (newResourceId === ResourcesIds.Lords) {
      // If changing to Lords, make sure sell resource is not Lords
      if (sellResourceId === ResourcesIds.Lords) {
        setSellResourceId(buyResourceId);
      }
    } else if (sellResourceId !== ResourcesIds.Lords) {
      // If neither would be Lords, set sell to Lords
      setSellResourceId(ResourcesIds.Lords);
    }
    setBuyResourceId(newResourceId);
    // Reset amounts when changing resources
    setBuyAmount(0);
    setSellAmount(0);
  };

  const sellResource = resources.find((r) => r.id === sellResourceId);
  const buyResource = resources.find((r) => r.id === buyResourceId);

  const handleConfirmSwap = async () => {
    try {
      const closestBank = getClosestBank(structureEntityId, components);

      if (!closestBank) {
        throw new Error("No bank found");
      }

      const operation = sellResourceId === ResourcesIds.Lords ? systemCalls.buy_resources : systemCalls.sell_resources;
      await operation({
        signer: account,
        bank_entity_id: closestBank.bankId,
        entity_id: structureEntityId,
        resource_type: sellResourceId === ResourcesIds.Lords ? buyResourceId : sellResourceId,
        amount: multiplyByPrecision(
          Number((sellResourceId === ResourcesIds.Lords ? buyAmount : sellAmount).toFixed(2)),
        ),
      });
    } catch (error) {
      console.error("Swap failed:", error);
      throw new Error("Swap failed");
    }
  };

  const slippage = marketManager.slippage(multiplyByPrecision(Math.abs(sellAmount - lpFee)), true) || 0;

  const marketPrice = marketManager.getMarketPrice();

  // Get closest bank and travel time
  const closestBank = useMemo(() => getClosestBank(structureEntityId, components), [structureEntityId, components]);

  return (
    <div className="container p-4 space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold font-bokor">The Lords Market</h1>
        <p className="text-muted-foreground">Choose pair to swap resources</p>
      </div>

      <div className="space-y-4 relative">
        <SwapInput
          direction="sell"
          amount={sellAmount}
          resourceId={sellResourceId}
          onAmountChange={handleSellAmountChange}
          onResourceChange={handleSellResourceChange}
          entityId={structureEntityId}
        />

        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 !mt-[0] z-10">
          <Button size="icon" variant="secondary" className="rounded-full shadow-md" onClick={handleSwap}>
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <SwapInput
          direction="buy"
          amount={buyAmount}
          resourceId={buyResourceId}
          onAmountChange={handleBuyAmountChange}
          onResourceChange={handleBuyResourceChange}
          entityId={structureEntityId}
        />
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!buyAmount || !sellAmount || !hasEnough}
        onClick={() => setIsConfirmOpen(true)}
      >
        {`Swap ${sellAmount} ${sellResource?.trait} for ${buyAmount} ${buyResource?.trait}`}
      </Button>

      {/* Summary Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Price</span>
            <span>
              1 {sellResource?.trait} = {marketPrice.toFixed(4)} {buyResource?.trait}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Slippage</span>
            <span className="text-red-500">-{slippage.toFixed(2)}%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Bank Owner Fees</span>
            <span className="text-red-500">
              {ownerFee.toFixed(2)} {sellResource?.trait}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">LP Fees</span>
            <span className="text-red-500">
              {lpFee.toFixed(2)} {sellResource?.trait}
            </span>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="flex justify-between items-center text-lg font-medium">
            <span>Total</span>
            <div className="flex flex-col items-end">
              <span>
                {sellAmount} {sellResource?.trait}
              </span>
              <span className="text-sm text-muted-foreground">
                ≈ {buyAmount} {buyResource?.trait}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {sellResource && buyResource && closestBank && (
        <SwapConfirmDrawer
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          sellAmount={sellAmount}
          buyAmount={buyAmount}
          sellResource={sellResource}
          buyResource={buyResource}
          onConfirm={handleConfirmSwap}
          travelTime={closestBank.travelTime}
        />
      )}
    </div>
  );
};
