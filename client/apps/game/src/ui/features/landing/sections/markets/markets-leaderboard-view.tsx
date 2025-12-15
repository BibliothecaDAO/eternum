import { Card, CardContent, CardHeader, CardTitle, HStack, ScrollArea, VStack } from "@pm/ui";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { displayAddress } from "@/ui/utils/utils";

import { LEADERBOARD_RANGES, TabButton, formatNumber } from "./market-tabs";
import type { MarketLeaderboardRange } from "./use-market-stats";
import { useMarketsLeaderboard } from "./use-markets-leaderboard";

type MarketsLeaderboardViewProps = {
  initialRange?: MarketLeaderboardRange;
};

export const MarketsLeaderboardView = ({ initialRange = "all" }: MarketsLeaderboardViewProps) => {
  const { entries, range, setRange, isLoading, refresh } = useMarketsLeaderboard(initialRange);

  return (
    <div className="space-y-4">
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

      <Card className="border-white/10 bg-black/50">
        <CardHeader className="flex items-center justify-between gap-2 px-2 sm:px-3">
          <CardTitle className="text-lg text-white">Top earners</CardTitle>
          <span className="text-xs text-gold/70">Ranked by LORDS earned, showing {entries.length || 0} players</span>
        </CardHeader>
        <CardContent className="px-2 sm:px-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_item, idx) => (
                <div key={idx} className="h-12 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gold/70">No trading activity yet.</p>
          ) : (
            <ScrollArea className="max-h-[360px] pr-1">
              <VStack className="divide-y divide-white/5">
                {entries.map((entry, index) => (
                  <HStack
                    key={`${entry.address}-${index}`}
                    className="items-center justify-between gap-3 py-2 text-sm text-white/90"
                  >
                    <HStack className="gap-3">
                      <span className="min-w-[28px] text-right text-gold/80">#{index + 1}</span>
                      <span className="font-semibold">{displayAddress(entry.address)}</span>
                    </HStack>
                    <HStack className="gap-4 text-xs sm:text-sm">
                      <span className="rounded-md bg-white/5 px-2 py-1 text-emerald-200">
                        Earned {formatNumber(entry.earned, 4)} LORDS
                      </span>
                      <span className="rounded-md bg-white/5 px-2 py-1 text-white/80">
                        Volume {formatNumber(entry.volume, 2)} LORDS
                      </span>
                      <span className="hidden rounded-md bg-white/5 px-2 py-1 text-gold/80 sm:inline">
                        {entry.trades} trades · {entry.markets} markets
                      </span>
                    </HStack>
                  </HStack>
                ))}
              </VStack>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
