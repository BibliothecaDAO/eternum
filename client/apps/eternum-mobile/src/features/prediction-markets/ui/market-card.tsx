import { MarketClass } from "@/pm/class";
import { ROUTES } from "@/shared/consts/routes";
import { Card } from "@/shared/ui/card";
import { Link } from "@tanstack/react-router";
import { formatTimestamp } from "../lib/market-utils";
import { MarketStatusBadge } from "./market-status-badge";

interface MarketCardProps {
  market: MarketClass;
}

export const MarketCard = ({ market }: MarketCardProps) => {
  return (
    <Link to={ROUTES.MARKET_DETAILS} params={{ marketId: market.market_id }}>
      <Card className="space-y-2 border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
        <div className="flex items-center justify-between gap-2">
          <MarketStatusBadge market={market} />
          <span className="text-xs text-muted-foreground">{market.collateralToken?.symbol ?? "TOKEN"}</span>
        </div>
        <div className="text-sm font-semibold">{market.title || "Untitled market"}</div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Start</span>
            <span>{formatTimestamp(market.start_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>End</span>
            <span>{formatTimestamp(market.end_at)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
};
