import { MarketOdds, MarketStatusBadge, MarketTrade, MarketsProviders } from "@/features/prediction-markets";
import { type MarketOutcome } from "@/pm/class";
import { useMarket } from "@/pm/sdk";
import { ROUTES } from "@/shared/consts/routes";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { formatTimestamp } from "@/features/prediction-markets/lib/market-utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const parseMarketId = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

const MarketDetailsContent = ({ marketId }: { marketId: bigint | null }) => {
  const navigate = useNavigate();
  const { market, refresh, isLoading } = useMarket(marketId ?? 0n);
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);

  const defaultHighestOutcome = useMemo(() => {
    if (!market) return undefined;
    const outcomes = market.getMarketOutcomes();
    if (!outcomes || outcomes.length === 0) return undefined;
    return outcomes.reduce<MarketOutcome | undefined>((best, current) => {
      const currentOdds = Number((current as any)?.odds ?? 0);
      const bestOdds = best ? Number((best as any)?.odds ?? 0) : -Infinity;
      if (!Number.isFinite(currentOdds)) return best;
      if (!best || currentOdds > bestOdds) return current;
      return best;
    }, undefined);
  }, [market]);

  useEffect(() => {
    if (defaultHighestOutcome && !selectedOutcome) {
      setSelectedOutcome(defaultHighestOutcome);
    }
  }, [defaultHighestOutcome, selectedOutcome]);

  if (isLoading) {
    return <Card className="border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">Loading market...</Card>;
  }

  if (!market) {
    return <Card className="border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">Market not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={() => navigate({ to: ROUTES.MARKETS })}>
          <ArrowLeft className="mr-2 h-3 w-3" />
          Back
        </Button>
        <Button size="sm" variant="secondary" onClick={() => refresh()}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh
        </Button>
      </div>

      <Card className="space-y-2 border-border/60 bg-card/80 p-4">
        <MarketStatusBadge market={market} />
        <div className="text-base font-semibold">{market.title || "Untitled market"}</div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Start</span>
            <span>{formatTimestamp(market.start_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>End</span>
            <span>{formatTimestamp(market.end_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Resolve</span>
            <span>{formatTimestamp(market.resolve_at)}</span>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-border/60 bg-card/80 p-4">
        <h2 className="text-sm font-semibold">Outcomes</h2>
        <MarketOdds
          market={market}
          selectable={!market.isEnded() && !market.isResolved()}
          selectedOutcomeIndex={selectedOutcome?.index}
          onSelect={(outcome) => setSelectedOutcome(outcome)}
        />
      </Card>

      <MarketTrade market={market} selectedOutcome={selectedOutcome} setSelectedOutcome={setSelectedOutcome} />
    </div>
  );
};

export const MarketDetailsPage = () => {
  const params = useParams({ strict: false }) as { marketId?: string };
  const marketId = parseMarketId(params.marketId);

  return (
    <MarketsProviders>
      <div className="min-h-screen space-y-4 bg-gradient-to-br from-background to-muted/20 p-4 pb-24">
        <MarketDetailsContent marketId={marketId} />
      </div>
    </MarketsProviders>
  );
};
