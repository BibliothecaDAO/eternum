import { Card, CardContent, CardHeader, CardTitle, HStack, ScrollArea, VStack } from "@pm/ui";
import { Link } from "react-router-dom";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";

import { ArrowUpRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { MarketStatusBadge } from "./market-status-badge";
import { formatNumber } from "./market-tabs";
import { TokenIcon } from "./token-icon";
import type { PlayerSummary } from "./use-market-stats";
import { useMarketRedeem } from "./use-market-redeem";

type PlayerMarketsViewProps = {
  isLoading: boolean;
  onRefresh: () => void;
  hasWallet: boolean;
  summary: PlayerSummary;
};

const StatCard = ({
  label,
  value,
  token,
  trend,
  trendColor,
}: {
  label: string;
  value: string | number;
  token?: any;
  trend?: "up" | "down";
  trendColor?: string;
}) => {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] p-4 transition-all hover:from-white/10 hover:to-white/5">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gold/5 blur-2xl transition-all group-hover:bg-gold/10" />
      <div className="relative space-y-1">
        <div className="text-xs font-medium uppercase tracking-wider text-gold/50">{label}</div>
        <div className={`flex items-center gap-2 text-xl font-bold ${trendColor || "text-white"}`}>
          {TrendIcon && <TrendIcon className="h-4 w-4" />}
          <span>{value}</span>
          {token && <TokenIcon token={token} size={18} />}
        </div>
      </div>
    </Card>
  );
};

const PlayerMarketRow = ({ entry }: { entry: PlayerSummary["markets"][number] }) => {
  const market = entry.market as any;
  const { claimableDisplay, hasRedeemablePositions, redeem, isRedeeming } = useMarketRedeem(market);

  const href =
    market && market.market_id
      ? (() => {
          try {
            return `/markets/0x${BigInt(market.market_id).toString(16)}`;
          } catch {
            return "#";
          }
        })()
      : "#";
  const isLinkable = href !== "#";
  const isResolved = market?.isResolved();
  const showClaim = Boolean(isResolved && hasRedeemablePositions);

  return (
    <div className="group grid grid-cols-1 gap-3 py-4 transition-all hover:bg-white/[0.02] md:grid-cols-[1fr_auto]">
      <div className="min-w-0 space-y-2">
        <HStack className="items-center gap-2">
          {isLinkable ? (
            <Link
              className="flex items-center gap-1.5 font-semibold leading-tight text-white transition-colors hover:text-gold"
              to={href}
              title={market?.title}
            >
              {market?.title || "Unknown market"}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ) : (
            <div className="font-semibold leading-tight text-white">{market?.title || "Unknown market"}</div>
          )}
          {market ? <MarketStatusBadge market={market} /> : null}
        </HStack>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 text-white/60">
            <span className="font-medium text-gold/60">Volume</span>
            <span className="font-semibold text-white/80">{formatNumber(entry.volume, 2)}</span>
            {market?.collateralToken && <TokenIcon token={market.collateralToken as any} size={14} />}
          </span>
          <span className="inline-flex items-center gap-1.5 text-white/60">
            <span className="font-medium text-gold/60">Earned</span>
            <span className="font-semibold text-emerald-300/90">{formatNumber(entry.earned, 2)}</span>
            {market?.collateralToken && <TokenIcon token={market.collateralToken as any} size={14} />}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end">
        {showClaim ? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-all hover:from-emerald-500/30 hover:to-emerald-500/20"
            onClick={() => redeem()}
            disabled={isRedeeming}
          >
            {isRedeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                Claim {claimableDisplay}
                {market?.collateralToken && <TokenIcon token={market.collateralToken as any} size={14} />}
              </span>
            )}
          </button>
        ) : (
          <div
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
              entry.pnl >= 0
                ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20"
                : "bg-red-500/10 text-red-200 ring-1 ring-red-500/20"
            }`}
          >
            {entry.pnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>
              {entry.pnl >= 0 ? "+" : ""}
              {formatNumber(entry.pnl, 4)}
            </span>
            {market?.collateralToken && <TokenIcon token={market.collateralToken as any} size={14} />}
          </div>
        )}
      </div>
    </div>
  );
};

export const PlayerMarketsView = ({ isLoading, onRefresh, hasWallet, summary }: PlayerMarketsViewProps) => {
  if (!hasWallet) {
    return (
      <div className="rounded-xl border border-gold/10 bg-gradient-to-br from-gold/5 to-transparent p-6 text-center">
        <p className="text-sm font-medium text-gold/80">Connect a wallet to see your trading history.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy aria-live="polite">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_item, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  const collateralToken = summary.markets[0]?.market?.collateralToken as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            label="Profit/Loss"
            value={`${summary.pnl >= 0 ? "+" : ""}${formatNumber(summary.pnl, 4)}`}
            token={collateralToken}
            trend={summary.pnl >= 0 ? "up" : "down"}
            trendColor={summary.pnl >= 0 ? "text-emerald-300" : "text-red-300"}
          />
          <StatCard label="Total Earned" value={formatNumber(summary.earned, 2)} token={collateralToken} />
          <StatCard label="Total Volume" value={formatNumber(summary.volume, 2)} token={collateralToken} />
          <StatCard label="Markets Joined" value={summary.marketsParticipated} />
        </div>

        <RefreshButton
          aria-label="Refresh player stats"
          isLoading={isLoading}
          onClick={onRefresh}
          disabled={isLoading}
        />
      </div>

      <Card className="overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02]">
        <CardHeader className="border-b border-white/5 px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white">Your Markets</CardTitle>
            {summary.activeMarkets > 0 && (
              <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                {summary.activeMarkets} Active
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {summary.markets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gold/60">Join a market to start tracking your performance.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[480px]">
              <div className="px-5">
                <VStack className="divide-y divide-white/5">
                  {summary.markets.map((entry) => (
                    <PlayerMarketRow key={entry.marketId} entry={entry} />
                  ))}
                </VStack>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
