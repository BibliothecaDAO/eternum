import { Card, CardContent, CardHeader, CardTitle, ScrollArea, VStack } from "@pm/ui";
import { Link } from "react-router-dom";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";

import { formatNumber } from "./market-tabs";
import type { PlayerSummary } from "./use-market-stats";

type PlayerMarketsViewProps = {
  isLoading: boolean;
  onRefresh: () => void;
  hasWallet: boolean;
  summary: PlayerSummary;
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
            <div className={`text-lg font-semibold ${summary.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {summary.pnl >= 0 ? "+" : ""}
              {formatNumber(summary.pnl, 4)} LORDS
            </div>
          </Card>
          <Card className="bg-white/5 p-3 text-center text-sm text-white/90">
            <div className="text-xs uppercase tracking-wider text-gold/60">Volume</div>
            <div className="text-lg font-semibold text-white">{formatNumber(summary.volume, 2)} LORDS</div>
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

        <RefreshButton aria-label="Refresh player stats" isLoading={isLoading} onClick={onRefresh} disabled={isLoading} />
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
                {summary.markets.map((entry) => {
                  const href =
                    entry.market && entry.market.market_id
                      ? (() => {
                          try {
                            return `/markets/0x${BigInt(entry.market.market_id).toString(16)}`;
                          } catch {
                            return "#";
                          }
                        })()
                      : "#";
                  const isLinkable = href !== "#";

                  return (
                    <div
                      key={entry.marketId}
                      className="group flex items-center justify-between gap-3 py-3 text-sm text-white/90"
                    >
                      <div className="min-w-0">
                        {isLinkable ? (
                          <Link
                            className="font-semibold leading-tight text-white hover:text-gold"
                            to={href}
                            title={entry.market?.title}
                          >
                            {entry.market?.title || "Unknown market"}
                          </Link>
                        ) : (
                          <div className="font-semibold leading-tight text-white">{entry.market?.title || "Unknown market"}</div>
                        )}
                        <div className="mt-1 text-xs text-gold/70">
                          Volume {formatNumber(entry.volume, 2)} LORDS · Earned {formatNumber(entry.earned, 2)} LORDS
                        </div>
                      </div>
                      <div
                        className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${
                          entry.pnl >= 0 ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"
                        }`}
                      >
                        {entry.pnl >= 0 ? "+" : ""}
                        {formatNumber(entry.pnl, 4)} LORDS
                      </div>
                    </div>
                  );
                })}
              </VStack>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
