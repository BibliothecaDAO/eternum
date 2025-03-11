import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SwapInput } from "@/widgets/swap-input";
import { resources } from "@bibliothecadao/eternum";
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { SwapConfirmDrawer } from "./swap-confirm-drawer";

export const TradePage = () => {
  const [buyAmount, setBuyAmount] = useState(0);
  const [sellAmount, setSellAmount] = useState(0);
  const [buyResourceId, setBuyResourceId] = useState(1); // Default to first resource
  const [sellResourceId, setSellResourceId] = useState(2); // Default to second resource
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleSwap = () => {
    const tempResourceId = buyResourceId;
    setBuyResourceId(sellResourceId);
    setSellResourceId(tempResourceId);

    const tempAmount = buyAmount;
    setBuyAmount(sellAmount);
    setSellAmount(tempAmount);
  };

  const sellResource = resources.find((r) => r.id === sellResourceId);
  const buyResource = resources.find((r) => r.id === buyResourceId);

  const handleConfirmSwap = async () => {
    // Simulate API call
    await new Promise((resolve, reject) => setTimeout(Math.random() > 0.5 ? resolve : reject, 2000));
  };

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
          onAmountChange={setSellAmount}
          onResourceChange={setSellResourceId}
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
          onAmountChange={setBuyAmount}
          onResourceChange={setBuyResourceId}
        />
      </div>

      <Button className="w-full" size="lg" disabled={!buyAmount || !sellAmount} onClick={() => setIsConfirmOpen(true)}>
        Swap {sellAmount} {sellResource?.trait} for {buyAmount} {buyResource?.trait}
      </Button>

      {/* Summary Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Price</span>
            <span>
              1 {sellResource?.trait} = 0.002 {buyResource?.trait}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Slippage</span>
            <span className="text-red-500">-1.5%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Bank Owner Fees</span>
            <span className="text-red-500">12 LORDS</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">LP Fees</span>
            <span className="text-red-500">5 LORDS</span>
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
