import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useQuery } from "@tanstack/react-query";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatTokenAmount, type SwapEvent } from "@bibliothecadao/amm-sdk";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmSpotPrice } from "./amm-format";

function formatTradeAmount(value: bigint): string {
  const formatted = formatTokenAmount(value);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num > 0 && num < 0.0001) return "<0.0001";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  return num.toFixed(4);
}

export const AmmTradeHistory = () => {
  const { client, config, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["amm-trade-history", selectedPool],
    queryFn: async () => {
      if (!selectedPool || !client) return { data: [] as SwapEvent[], pagination: { total: 0, limit: 50, offset: 0 } };
      return client.api.getSwapHistory(selectedPool, { limit: 50 });
    },
    enabled: Boolean(client),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!isConfigured || !client) {
    return <div className="p-4 text-center text-gold/40 text-sm">AMM is not configured</div>;
  }

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
      <div className="rounded-2xl border border-gold/10 bg-black/25 p-4 text-center text-gold/40 text-sm">
        <div>{error ? "Could not load trade history" : "No trade history available"}</div>
        <div className="text-xs mt-1 text-gold/30">
          {error
            ? "Try again in a moment."
            : selectedPool
              ? "No trades found for this pool"
              : "Select a pool to view trades"}
        </div>
        {error && (
          <button
            className="mt-3 text-xs uppercase tracking-[0.16em] text-gold hover:text-gold/80"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const trades = data.data;

  return (
    <div className="space-y-2">
      {trades.map((trade: SwapEvent, i: number) => {
        const isBuy = trade.tokenIn.toLowerCase() === config.lordsAddress.toLowerCase();
        const tradedTokenAddress = isBuy ? trade.tokenOut : trade.tokenIn;
        const tradedToken = resolveAmmAssetPresentation(tradedTokenAddress, config.lordsAddress);
        const price = trade.amountOut > 0n ? Number(trade.amountIn) / Number(trade.amountOut) : 0;

        return (
          <div
            key={`${trade.txHash}-${i}`}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/10 bg-black/25 px-3 py-2.5"
          >
            {/* Token icon + name + time */}
            <div className="flex min-w-0 items-center gap-2.5 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-black/35">
                {tradedToken.iconResource ? (
                  <ResourceIcon
                    resource={tradedToken.iconResource}
                    size="sm"
                    withTooltip={false}
                    className="!h-4 !w-4"
                  />
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold/70">
                    {tradedToken.shortLabel.slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-gold">{tradedToken.displayName}</div>
                <div className="text-[10px] text-gold/35">
                  {new Date(trade.timestamp * 1000).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>

            {/* Buy/Sell badge */}
            <div
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]",
                isBuy
                  ? "border-progress-bar-good/30 bg-progress-bar-good/10 text-progress-bar-good"
                  : "border-danger/30 bg-danger/10 text-danger",
              )}
            >
              {isBuy ? "Buy" : "Sell"}
            </div>

            {/* In / Out / Rate - compact inline */}
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-gold/35 mr-1">In</span>
                <span className="font-medium text-gold">{formatTradeAmount(trade.amountIn)}</span>
              </div>
              <div>
                <span className="text-gold/35 mr-1">Out</span>
                <span className="font-medium text-gold">{formatTradeAmount(trade.amountOut)}</span>
              </div>
              <div>
                <span className="text-gold/35 mr-1">Rate</span>
                <span className="font-medium text-gold">{formatAmmSpotPrice(price)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
