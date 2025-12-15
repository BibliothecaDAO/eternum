import { Card, CardContent, CardHeader, CardTitle, HStack, ScrollArea, VStack } from "@pm/ui";
import { Link } from "react-router-dom";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";

import { Loader2 } from "lucide-react";
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
    <div className="group flex items-center justify-between gap-3 py-3 text-sm text-white/90">
      <div className="min-w-0 space-y-1">
        <HStack className="items-center gap-2">
          {isLinkable ? (
            <Link className="font-semibold leading-tight text-white hover:text-gold" to={href} title={market?.title}>
              {market?.title || "Unknown market"}
            </Link>
          ) : (
            <div className="font-semibold leading-tight text-white">{market?.title || "Unknown market"}</div>
          )}
          {market ? <MarketStatusBadge market={market} /> : null}
        </HStack>
        <div className="text-xs text-gold/70">
          <span className="inline-flex items-center gap-1">
            Volume {formatNumber(entry.volume, 2)}
            {market?.collateralToken ? <TokenIcon token={market.collateralToken as any} size={14} /> : null}
          </span>
          <span className="mx-1 text-white/40">·</span>
          <span className="inline-flex items-center gap-1">
            Earned {formatNumber(entry.earned, 2)}
            {market?.collateralToken ? <TokenIcon token={market.collateralToken as any} size={14} /> : null}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {showClaim ? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-md bg-progress-bar-good/80 px-3 py-2 text-xs font-semibold text-white hover:bg-progress-bar-good"
            onClick={() => redeem()}
            disabled={isRedeeming}
          >
            {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>
              Claim {claimableDisplay}
              {market?.collateralToken ? <TokenIcon token={market.collateralToken as any} size={14} /> : null}
            </span>
          </button>
        ) : (
          <div
            className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${
              entry.pnl >= 0 ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {entry.pnl >= 0 ? "+" : ""}
              {formatNumber(entry.pnl, 4)}
              {market?.collateralToken ? <TokenIcon token={market.collateralToken as any} size={14} /> : null}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const PlayerMarketsView = ({ isLoading, onRefresh, hasWallet, summary }: PlayerMarketsViewProps) => {
  if (!hasWallet) {
    return <p className="text-sm text-gold/80">Connect a wallet to see your trading history.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy aria-live="polite">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_item, idx) => (
            <div key={idx} className="h-16 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">PnL</div>
            <div
              className={`flex items-center justify-center gap-2 text-lg font-semibold ${summary.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}
            >
              <span>
                {summary.pnl >= 0 ? "+" : ""}
                {formatNumber(summary.pnl, 4)}
              </span>
              {summary.markets[0]?.market?.collateralToken ? (
                <TokenIcon token={summary.markets[0].market.collateralToken as any} size={16} />
              ) : null}
            </div>
          </Card>
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">Earned</div>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-white">
              <span>{formatNumber(summary.earned, 2)}</span>
              {summary.markets[0]?.market?.collateralToken ? (
                <TokenIcon token={summary.markets[0].market.collateralToken as any} size={16} />
              ) : null}
            </div>
          </Card>
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">Volume</div>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-white">
              <span>{formatNumber(summary.volume, 2)}</span>
              {summary.markets[0]?.market?.collateralToken ? (
                <TokenIcon token={summary.markets[0].market.collateralToken as any} size={16} />
              ) : null}
            </div>
          </Card>
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">Markets joined</div>
            <div className="text-lg font-semibold text-white">{summary.marketsParticipated}</div>
          </Card>
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">Active</div>
            <div className="text-lg font-semibold text-white">{summary.activeMarkets}</div>
          </Card>
        </div>

        <RefreshButton
          aria-label="Refresh player stats"
          isLoading={isLoading}
          onClick={onRefresh}
          disabled={isLoading}
        />
      </div>

      <Card className="bg-white/5">
        <CardHeader className="px-3 pb-0">
          <CardTitle className="text-white">Your markets</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          {summary.markets.length === 0 ? (
            <p className="text-sm text-gold/70">Join a market to start tracking your performance.</p>
          ) : (
            <ScrollArea className="max-h-[360px] pr-1">
              <VStack className="divide-y divide-white/5">
                {summary.markets.map((entry) => (
                  <PlayerMarketRow key={entry.marketId} entry={entry} />
                ))}
              </VStack>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
