import { getAvatarUrl, normalizeAvatarAddress, useAvatarProfiles } from "@/hooks/use-player-avatar";
import type { MarketClass } from "@/pm/class";
import { PMActivitySkeleton, PMErrorState } from "@/pm/components/loading";
import { useMarketActivity } from "@/pm/hooks/social/use-market-activity";
import { formatUnits } from "@/pm/utils";
import { useAccount } from "@starknet-react/core";
import { useMemo } from "react";
import { MaybeController } from "../maybe-controller";
import { TokenIcon } from "../token-icon";

const AvatarImage = ({
  address,
  avatarUrl,
  className,
  highlight,
}: {
  address: string;
  avatarUrl: string;
  className?: string;
  highlight?: boolean;
}) => {
  return (
    <img
      src={avatarUrl}
      alt={`${address} avatar`}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
        highlight ? "ring-1 ring-gold/50" : "ring-1 ring-gold/20"
      } ${className ?? ""}`}
      loading="lazy"
      decoding="async"
    />
  );
};

const formatTradeTimestamp = (date: Date) =>
  date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const TimeAgo = ({ date, className }: { date: Date; className?: string }) => (
  <span className={className}>{formatTradeTimestamp(date)}</span>
);

export const MarketActivity = ({ market, refreshKey = 0 }: { market: MarketClass; refreshKey?: number }) => {
  const { account } = useAccount();
  const { marketBuys, isLoading, isError } = useMarketActivity(market.market_id, refreshKey);
  const activityAddresses = useMemo(() => marketBuys.map((entry) => entry.account_address), [marketBuys]);
  const { data: avatarProfiles = [] } = useAvatarProfiles(activityAddresses);
  const avatarUrlByAddress = useMemo(() => {
    const map = new Map<string, string | null>();
    avatarProfiles.forEach((profile) => {
      const normalized = normalizeAvatarAddress(profile.playerAddress);
      if (!normalized) return;
      map.set(normalized, profile.avatarUrl ?? null);
    });
    return map;
  }, [avatarProfiles]);

  // Loading state (only show skeleton on initial load with no data)
  if (isLoading && marketBuys.length === 0) {
    return <PMActivitySkeleton count={3} />;
  }

  // Error state
  if (isError) {
    return <PMErrorState message="Failed to load activity" />;
  }

  // Empty state
  if (marketBuys.length === 0) {
    return (
      <div className="w-full rounded-lg border border-dashed border-gold/15 bg-dark-wood px-4 py-5 text-sm text-gold/70">
        <p className="text-lightest">Market activity</p>
        <p className="mt-1 text-xs text-gold/60">Trades will appear here once the market starts moving.</p>
      </div>
    );
  }

  const outcomes = market.getMarketOutcomes();

  return (
    <div className="space-y-3">
      {marketBuys.map((marketBuy) => {
        const isSelf = BigInt(marketBuy.account_address) === BigInt(account?.address || 0);
        const outcome = outcomes[Number(marketBuy.outcome_index)];
        const amountFormatted = formatUnits(marketBuy.amount, Number(market.collateralToken.decimals), 2);
        const entryKey = `${marketBuy.account_address}-${marketBuy.timestamp}-${marketBuy.outcome_index}-${marketBuy.amount}`;
        const normalizedAccount = normalizeAvatarAddress(marketBuy.account_address);
        const avatarUrl = getAvatarUrl(
          normalizedAccount ?? marketBuy.account_address,
          normalizedAccount ? avatarUrlByAddress.get(normalizedAccount) : undefined,
        );

        return (
          <div
            key={entryKey}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
              isSelf ? "border-gold/50 bg-gold/5" : "border-gold/15 bg-brown/45"
            }`}
          >
            <AvatarImage address={marketBuy.account_address} avatarUrl={avatarUrl} highlight={isSelf} />

            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gold/70">
                <div className="flex items-center gap-2">
                  <MaybeController address={marketBuy.account_address} className="text-lightest" />
                  {isSelf && (
                    <span className="rounded-full bg-gold/20 px-2 py-[2px] text-[10px] font-semibold uppercase text-dark">
                      You
                    </span>
                  )}
                </div>
                <TimeAgo date={new Date(Number(marketBuy.timestamp))} className="text-gold/60" />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-lightest">
                <span className="rounded-full bg-gold/10 px-2 py-[3px] text-[11px] uppercase tracking-wide text-gold/70">
                  Bought
                </span>

                <div className="flex items-center gap-2 text-base font-semibold">
                  <span>{amountFormatted}</span>
                  <TokenIcon token={market.collateralToken} size={24} />
                </div>

                <span className="text-gold/60">on</span>

                <div className="flex items-center gap-2 rounded-md bg-gold/10 px-2 py-1 text-sm">
                  <MaybeController
                    address={outcome?.name ?? `Outcome #${Number(marketBuy.outcome_index) + 1}`}
                    className="text-lightest"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
