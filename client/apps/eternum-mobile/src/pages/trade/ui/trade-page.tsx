import { getBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SwapInput } from "@/widgets/swap-input";
import {
  configManager,
  ContractAddress,
  divideByPrecision,
  getBalance,
  MarketManager,
  multiplyByPrecision,
  resources,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ArrowDownUp } from "lucide-react";
import { useMemo, useState } from "react";
import { SwapConfirmDrawer } from "./swap-confirm-drawer";

export const TradePage = () => {
  const [buyAmount, setBuyAmount] = useState(0);
  const [sellAmount, setSellAmount] = useState(0);
  const [buyResourceId, setBuyResourceId] = useState(1); // Default to first resource
  const [sellResourceId, setSellResourceId] = useState(2); // Default to second resource
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { structureEntityId } = useStore();

  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const marketManager = useMemo(
    () => new MarketManager(components, ContractAddress(account.address), sellResourceId),
    [components, sellResourceId, account.address],
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

  const sellResource = resources.find((r) => r.id === sellResourceId);
  const buyResource = resources.find((r) => r.id === buyResourceId);

  const handleConfirmSwap = async () => {
    try {
      const operation = sellResourceId === ResourcesIds.Lords ? systemCalls.buy_resources : systemCalls.sell_resources;
      await operation({
        signer: account,
        bank_entity_id: structureEntityId,
        entity_id: structureEntityId,
        resource_type: sellResourceId === ResourcesIds.Lords ? buyResourceId : sellResourceId,
        amount: multiplyByPrecision(Number(sellAmount.toFixed(2))),
      });
      setIsConfirmOpen(false);
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  const slippage = marketManager.slippage(multiplyByPrecision(Math.abs(sellAmount - lpFee)), true) || 0;

  const marketPrice = marketManager.getMarketPrice();

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
          onResourceChange={setSellResourceId}
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
          onResourceChange={setBuyResourceId}
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

      {sellResource && buyResource && (
        <SwapConfirmDrawer
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          sellAmount={sellAmount}
          buyAmount={buyAmount}
          sellResource={sellResource}
          buyResource={buyResource}
          onConfirm={handleConfirmSwap}
        />
      )}
    </div>
  );
};
