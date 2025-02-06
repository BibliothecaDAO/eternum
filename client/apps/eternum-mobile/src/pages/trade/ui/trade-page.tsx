import { Button } from "@/shared/ui/button";
import { SwapInput } from "@/widgets/swap-input";
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";

export const TradePage = () => {
  const [buyAmount, setBuyAmount] = useState(0);
  const [sellAmount, setSellAmount] = useState(0);
  const [buyResourceId, setBuyResourceId] = useState(1); // Default to first resource
  const [sellResourceId, setSellResourceId] = useState(2); // Default to second resource

  const handleSwap = () => {
    const tempResourceId = buyResourceId;
    setBuyResourceId(sellResourceId);
    setSellResourceId(tempResourceId);

    const tempAmount = buyAmount;
    setBuyAmount(sellAmount);
    setSellAmount(tempAmount);
  };

  return (
    <div className="container p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">The Lord Market</h1>
        <p className="text-muted-foreground">Choose pair to swap resources</p>
      </div>

      <div className="space-y-4 relative">
        <SwapInput
          direction="buy"
          amount={buyAmount}
          resourceId={buyResourceId}
          onAmountChange={setBuyAmount}
          onResourceChange={setBuyResourceId}
        />

        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 !mt-[0] z-10">
          <Button size="icon" variant="secondary" className="rounded-full shadow-md" onClick={handleSwap}>
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <SwapInput
          direction="sell"
          amount={sellAmount}
          resourceId={sellResourceId}
          onAmountChange={setSellAmount}
          onResourceChange={setSellResourceId}
        />
      </div>
    </div>
  );
};
