import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import type { CandleInterval, PriceCandle } from "@bibliothecadao/amm-sdk";

const INTERVALS: { label: string; value: CandleInterval }[] = [
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
];

export const AmmPriceChart = () => {
  const { client, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const [interval, setInterval] = useState<CandleInterval>("1h");

  const { data: candles, isLoading } = useQuery<PriceCandle[]>({
    queryKey: ["amm-candles", selectedPool, interval],
    queryFn: async () => {
      if (!selectedPool || !client) return [];
      return client.api.getPriceHistory(selectedPool, interval);
    },
    enabled: Boolean(client) && Boolean(selectedPool),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(() => {
    if (!candles || candles.length === 0) return null;

    const closes = candles.map((c) => c.close);
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const range = maxPrice - minPrice || 1;

    const width = 600;
    const height = 200;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = candles
      .map((c, i) => {
        const x = padding + (i / (candles.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((c.close - minPrice) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");

    return { points, width, height, currentPrice: closes[closes.length - 1], minPrice, maxPrice };
  }, [candles]);

  if (isLoading) {
    return (
      <div className="bg-gold/10 rounded-xl p-4 text-center text-gold/60 text-sm">
        <div className="w-4 h-4 border-t-2 border-gold rounded-full animate-spin mx-auto mb-2" />
        Loading chart...
      </div>
    );
  }

  if (!isConfigured || !client) {
    return (
      <div className="bg-gold/10 rounded-xl p-4">
        <div className="flex items-center justify-center h-[200px] text-gold/40 text-sm">AMM is not configured</div>
      </div>
    );
  }

  return (
    <div className="bg-gold/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gold">Price Chart</h3>
        <div className="flex gap-1">
          {INTERVALS.map((int) => (
            <button
              key={int.value}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                interval === int.value ? "bg-gold/30 text-gold" : "text-gold/60 hover:text-gold hover:bg-gold/10"
              }`}
              onClick={() => setInterval(int.value)}
            >
              {int.label}
            </button>
          ))}
        </div>
      </div>

      {!chartData ? (
        <div className="flex items-center justify-center h-[200px] text-gold/40 text-sm">
          {selectedPool ? "No price data available" : "Select a pool to view chart"}
        </div>
      ) : (
        <div>
          <div className="text-lg font-bold text-gold mb-2">{chartData.currentPrice.toFixed(4)} LORDS</div>
          <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="w-full" preserveAspectRatio="none">
            <polyline fill="none" stroke="#dfaa54" strokeWidth="2" points={chartData.points} />
          </svg>
        </div>
      )}
    </div>
  );
};
