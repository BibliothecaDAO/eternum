import type { MarketClass } from "@/pm/class";
import { useState } from "react";

import { useMarketActivity } from "@/pm/hooks/social/use-market-activity";
import { formatUnits } from "@/pm/utils";
import { useAccount } from "@starknet-react/core";
import { MaybeController } from "../maybe-controller";
import { TokenIcon } from "../token-icon";

const AvatarImage = ({
  address,
  className,
  highlight,
}: {
  address: string;
  className?: string;
  highlight?: boolean;
}) => {
  const initial = address ? address.slice(2, 4).toUpperCase() : "??";
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
        highlight ? "bg-gold/20 text-dark ring-1 ring-gold/50" : "bg-white/10 text-white ring-1 ring-white/10"
      } ${className ?? ""}`}
    >
      {initial}
    </div>
  );
};

const TimeAgo = ({ date, className }: { date: Date; className?: string }) => {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  const label = minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
  return <span className={className}>{label}</span>;
};

export const MarketActivity = ({ market }: { market: MarketClass }) => {
  const { account } = useAccount();
  const { marketBuys, refresh } = useMarketActivity(market.market_id);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (marketBuys.length === 0) {
    return (
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/70">
        <p className="text-white">Market activity</p>
        <p className="mt-1 text-xs text-gold/60">Trades will appear here once the market starts moving.</p>
      </div>
    );
  }

  const outcomes = market.getMarketOutcomes();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold/80 transition-colors hover:border-gold/50 hover:text-gold"
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-3">
        {marketBuys.map((marketBuy) => {
          const isSelf = BigInt(marketBuy.account_address) === BigInt(account?.address || 0);
          const outcome = outcomes[Number(marketBuy.outcome_index)];
          const amountFormatted = formatUnits(marketBuy.amount, Number(market.collateralToken.decimals), 2);
          const entryKey = `${marketBuy.account_address}-${marketBuy.timestamp}-${marketBuy.outcome_index}-${marketBuy.amount}`;

          return (
            <div
              key={entryKey}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
                isSelf ? "border-gold/50 bg-gold/5" : "border-white/10 bg-white/5"
              }`}
            >
              <AvatarImage address={marketBuy.account_address} highlight={isSelf} />

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gold/70">
                  <div className="flex items-center gap-2">
                    <MaybeController address={marketBuy.account_address} className="text-white" />
                    {isSelf && (
                      <span className="rounded-full bg-gold/20 px-2 py-[2px] text-[10px] font-semibold uppercase text-dark">
                        You
                      </span>
                    )}
                  </div>
                  <TimeAgo date={new Date(Number(marketBuy.timestamp))} className="text-gold/60" />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white">
                  <span className="rounded-full bg-white/10 px-2 py-[3px] text-[11px] uppercase tracking-wide text-gold/70">
                    Bought
                  </span>

                  <div className="flex items-center gap-2 text-base font-semibold">
                    <span>{amountFormatted}</span>
                    <TokenIcon token={market.collateralToken} size={24} />
                  </div>

                  <span className="text-gold/60">on</span>

                  <div className="flex items-center gap-2 rounded-md bg-white/10 px-2 py-1 text-sm">
                    <MaybeController
                      address={outcome?.name ?? `Outcome #${Number(marketBuy.outcome_index) + 1}`}
                      className="text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
