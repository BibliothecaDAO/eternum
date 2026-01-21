import { Crown, Medal, Trophy } from "lucide-react";
import { ScrollArea } from "@pm/ui";

import { Panel } from "@/ui/design-system/atoms/panel";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { MaybeController } from "./maybe-controller";
import { TokenIcon } from "./token-icon";
import { LEADERBOARD_RANGES, TabButton, formatNumber } from "./market-tabs";
import type { MarketLeaderboardRange } from "./use-market-stats";
import { useMarketsLeaderboard } from "./use-markets-leaderboard";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type MarketsLeaderboardViewProps = {
  initialRange?: MarketLeaderboardRange;
};

const RANK_STYLES = {
  1: {
    bg: "bg-gradient-to-r from-gold/20 to-gold/5",
    border: "border-gold/40",
    ring: "ring-1 ring-gold/30",
    text: "text-gold",
    icon: Crown,
    iconColor: "text-gold",
  },
  2: {
    bg: "bg-gradient-to-r from-gray-400/15 to-gray-400/5",
    border: "border-gray-400/30",
    ring: "",
    text: "text-gray-300",
    icon: Trophy,
    iconColor: "text-gray-300",
  },
  3: {
    bg: "bg-gradient-to-r from-orange/15 to-orange/5",
    border: "border-orange/30",
    ring: "",
    text: "text-orange",
    icon: Medal,
    iconColor: "text-orange",
  },
};

const getRankStyle = (rank: number) => {
  if (rank === 1) return RANK_STYLES[1];
  if (rank === 2) return RANK_STYLES[2];
  if (rank === 3) return RANK_STYLES[3];
  return null;
};

export const MarketsLeaderboardView = ({ initialRange = "all" }: MarketsLeaderboardViewProps) => {
  const { entries, range, setRange, isLoading, refresh } = useMarketsLeaderboard(initialRange);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {LEADERBOARD_RANGES.map((option) => (
            <TabButton
              key={option.id}
              isActive={range === option.id}
              label={option.label}
              onClick={() => setRange(option.id)}
            />
          ))}
        </div>
        <RefreshButton aria-label="Refresh leaderboard" isLoading={isLoading} onClick={refresh} disabled={isLoading} />
      </div>

      {/* Leaderboard Panel */}
      <Panel tone="wood" padding="md" radius="lg" border="subtle">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-gold/10 pb-3">
          <h3 className="font-cinzel text-lg font-semibold text-gold">Top Earners</h3>
          <span className="text-xs text-gold/50">
            {entries.length || 0} players ranked
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_item, idx) => (
              <div
                key={idx}
                className="h-14 animate-pulse rounded-lg bg-brown/50"
                style={{ animationDelay: `${idx * 100}ms` }}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-gold/30" />
            <p className="text-sm text-gold/50">No trading activity yet</p>
            <p className="mt-1 text-xs text-gold/30">Be the first to trade!</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const rankStyle = getRankStyle(rank);
                const RankIcon = rankStyle?.icon;

                return (
                  <div
                    key={`${entry.address}-${index}`}
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      "animate-fade-in-up",
                      rankStyle ? `${rankStyle.bg} ${rankStyle.border} ${rankStyle.ring}` : "border-gold/10 bg-brown/30 hover:bg-brown/50",
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Rank & Name */}
                    <div className="flex items-center gap-3">
                      {/* Rank Badge */}
                      <div
                        className={cx(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-cinzel text-sm font-bold",
                          rankStyle
                            ? `${rankStyle.bg} ${rankStyle.text}`
                            : "bg-brown/50 text-gold/60",
                        )}
                      >
                        {RankIcon ? (
                          <RankIcon className={cx("h-4 w-4", rankStyle?.iconColor)} />
                        ) : (
                          rank
                        )}
                      </div>

                      {/* Player Name */}
                      <div className="min-w-0">
                        <MaybeController
                          address={entry.address}
                          className={cx(
                            "truncate font-semibold",
                            rankStyle ? rankStyle.text : "text-gold/80",
                          )}
                        />
                        {/* Mobile: Show trades count under name */}
                        <p className="text-[10px] text-gold/40 sm:hidden">
                          {entry.trades} trades · {entry.markets} markets
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                      {/* Earned - Always visible */}
                      <div className="flex items-center gap-1.5 rounded-md bg-brilliance/10 px-2 py-1 text-xs font-medium text-brilliance">
                        <span className="hidden xs:inline">+</span>
                        <span>{formatNumber(entry.earned, 2)}</span>
                        {entry.collateralToken ? <TokenIcon token={entry.collateralToken as any} size={14} /> : null}
                      </div>

                      {/* PnL - Hidden on mobile */}
                      <div
                        className={cx(
                          "hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium sm:flex",
                          entry.pnl >= 0 ? "bg-brilliance/10 text-brilliance" : "bg-danger/10 text-danger",
                        )}
                      >
                        <span>{entry.pnl >= 0 ? "+" : ""}{formatNumber(entry.pnl, 2)}</span>
                      </div>

                      {/* Volume - Hidden on mobile */}
                      <div className="hidden items-center gap-1.5 rounded-md bg-gold/10 px-2 py-1 text-xs text-gold/70 md:flex">
                        <span>{formatNumber(entry.volume, 0)}</span>
                        <span className="text-gold/40">vol</span>
                      </div>

                      {/* Trades count - Desktop only */}
                      <span className="hidden rounded-md bg-brown/50 px-2 py-1 text-xs text-gold/50 lg:inline">
                        {entry.trades} · {entry.markets}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Panel>
    </div>
  );
};
