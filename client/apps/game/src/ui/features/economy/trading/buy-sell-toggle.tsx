import { useMarketStore } from "@/hooks/store/use-market-store";
import { memo } from "react";

export const BuySellToggle = memo(() => {
  const tradeDirection = useMarketStore((state) => state.tradeDirection);
  const setTradeDirection = useMarketStore((state) => state.setTradeDirection);

  return (
    <div className="flex rounded-lg overflow-hidden border border-gold/20">
      <button
        className={`flex-1 py-2 px-6 text-sm font-medium transition-all duration-200 ${
          tradeDirection === "buy"
            ? "bg-green/20 text-green border-r border-gold/20"
            : "bg-transparent text-gold/50 hover:text-gold/70 border-r border-gold/20"
        }`}
        onClick={() => setTradeDirection("buy")}
      >
        Buy
      </button>
      <button
        className={`flex-1 py-2 px-6 text-sm font-medium transition-all duration-200 ${
          tradeDirection === "sell"
            ? "bg-red/20 text-red"
            : "bg-transparent text-gold/50 hover:text-gold/70"
        }`}
        onClick={() => setTradeDirection("sell")}
      >
        Sell
      </button>
    </div>
  );
});

BuySellToggle.displayName = "BuySellToggle";
