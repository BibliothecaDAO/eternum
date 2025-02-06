import { SwapInput } from "@/widgets/swap-input";
import { useState } from "react";

export const TradePage = () => {
  const [buyAmount, setBuyAmount] = useState(0);
  const [sellAmount, setSellAmount] = useState(0);
  const [buyResourceId, setBuyResourceId] = useState(1); // Default to first resource
  const [sellResourceId, setSellResourceId] = useState(2); // Default to second resource

  return (
    <div className="container p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">The Lord Market</h1>
        <p className="text-muted-foreground">Choose pair to swap resources</p>
      </div>

      <div className="space-y-4">
        <SwapInput
          direction="buy"
          amount={buyAmount}
          resourceId={buyResourceId}
          onAmountChange={setBuyAmount}
          onResourceChange={setBuyResourceId}
        />
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
