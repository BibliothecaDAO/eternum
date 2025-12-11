import { type MarketFiltersParams, useMarkets } from "@pm/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, HStack, ScrollArea, VStack } from "@pm/ui";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { MarketImage } from "./MarketImage";
import { MarketOdds } from "./MarketOdds";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { MarketTimeline } from "./MarketTimeline";
import { MarketTvl } from "./MarketTvl";

export function MarketsList({ marketFilters }: { marketFilters: MarketFiltersParams }) {
  const { markets } = useMarkets({ marketFilters });

  const sortedMarkets = useMemo(() => {
    const getCreatedAt = (value: unknown) => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    return markets
      .filter(Boolean)
      .slice()
      .sort((a, b) => getCreatedAt(b.created_at) - getCreatedAt(a.created_at));
  }, [markets]);

  if (sortedMarkets.length === 0) {
    return <p className="text-sm text-gold/70">No markets are available yet.</p>;
  }

  const nowSec = Math.floor(Date.now() / 1_000);

  return (
    <VStack className="4xl:grid-cols-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {sortedMarkets.map((market, idx) => {
        const href = (() => {
          try {
            if (market?.market_id == null) return "#";
            return `/markets/0x${BigInt(market.market_id).toString(16)}`;
          } catch {
            return "#";
          }
        })();
        const isLinkable = href !== "#";

        const titleContent = (
          <HStack className="gap-3">
            <MarketImage market={market} className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-sm" />

            <div>{market.title || "Untitled market"}</div>
          </HStack>
        );

        return (
          <Card
            className="h-full gap-3 rounded-sm border border-gold/20 bg-dark/60 p-3 transition hover:border-gold/60"
            key={href !== "#" ? href : idx}
          >
            <CardHeader className="px-0">
              <CardTitle>
                {isLinkable ? (
                  <Link className="leading-normal hover:underline" to={href}>
                    {titleContent}
                  </Link>
                ) : (
                  titleContent
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-0">
              <VStack className="w-full">
                <VStack className="w-auto items-end">
                  <MarketTvl market={market} />
                </VStack>
              </VStack>

              <ScrollArea className="h-[120px] w-full pr-2">
                <MarketOdds market={market} selectable={false} />
              </ScrollArea>

              <CardDescription>
                <VStack className="gap-3">
                  <HStack className="justify-center">
                    <MarketStatusBadge market={market} />
                  </HStack>
                  {!(nowSec >= market.start_at && nowSec < market.end_at) ? (
                    <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-gold/80">
                      Market closed to trades
                    </div>
                  ) : null}

                  <MarketTimeline market={market} />
                </VStack>
              </CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </VStack>
  );
}
