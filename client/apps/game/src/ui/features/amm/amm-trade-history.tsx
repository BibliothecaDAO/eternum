import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useQuery } from "@tanstack/react-query";
import { formatTokenAmount, type SwapEvent } from "@bibliothecadao/amm-sdk";

export const AmmTradeHistory = () => {
  const { client } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const { data, isLoading, error } = useQuery({
    queryKey: ["amm-trade-history", selectedPool],
    queryFn: async () => {
      if (!selectedPool) return { data: [] as SwapEvent[], pagination: { total: 0, limit: 50, offset: 0 } };
      return client.api.getSwapHistory(selectedPool, { limit: 50 });
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gold/60 text-sm">
        <div className="w-4 h-4 border-t-2 border-gold rounded-full animate-spin mx-auto mb-2" />
        Loading trades...
      </div>
    );
  }

  if (error || !data || data.data.length === 0) {
    return (
      <div className="p-4 text-center text-gold/40 text-sm">
        <div>No trade history available</div>
        <div className="text-xs mt-1 text-gold/30">
          {selectedPool ? "No trades found for this pool" : "Select a pool to view trades"}
        </div>
      </div>
    );
  }

  const trades = data.data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gold/60 text-xs border-b border-gold/20">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-left p-2">Token</th>
            <th className="text-right p-2">Amount In</th>
            <th className="text-right p-2">Amount Out</th>
            <th className="text-right p-2">Price</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade: SwapEvent, i: number) => {
            const isBuy = trade.tokenIn === "0x1" || trade.tokenIn.toLowerCase().includes("lords");
            const time = new Date(trade.timestamp * 1000).toLocaleTimeString();
            const price = trade.amountOut > 0n ? Number(trade.amountIn) / Number(trade.amountOut) : 0;

            return (
              <tr key={`${trade.txHash}-${i}`} className="border-b border-gold/10 hover:bg-gold/5">
                <td className="p-2 text-gold/60">{time}</td>
                <td className={`p-2 ${isBuy ? "text-green" : "text-danger"}`}>{isBuy ? "Buy" : "Sell"}</td>
                <td className="p-2 text-gold">{trade.tokenOut.slice(0, 8)}...</td>
                <td className="p-2 text-right text-gold">{formatTokenAmount(trade.amountIn)}</td>
                <td className="p-2 text-right text-gold">{formatTokenAmount(trade.amountOut)}</td>
                <td className="p-2 text-right text-gold">{price.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
