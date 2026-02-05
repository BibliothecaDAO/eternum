import { cn } from "@/ui/design-system/atoms/lib/utils";
import { MarketsProviders } from "@/ui/features/landing/sections/markets";
import { MarketsList } from "@/ui/features/landing/sections/markets/markets-list";
import { MarketStatusFilter, MarketTypeFilter, type MarketFiltersParams } from "@pm/sdk";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface MarketsViewProps {
  className?: string;
}

type MarketsTab = "live" | "past";

/**
 * Live markets content - shows only OPEN prediction markets
 */
const LiveMarketsContent = () => {
  const marketFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Open,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  return <MarketsList marketFilters={marketFilters} />;
};

/**
 * Past markets content - shows RESOLVABLE and RESOLVED prediction markets
 */
const PastMarketsContent = () => {
  const resolvableFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Resolvable,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  const resolvedFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Resolved,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  return (
    <div className="space-y-8">
      {/* Resolvable Markets */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-400/80">Awaiting Resolution</h3>
        <MarketsList marketFilters={resolvableFilters} />
      </div>

      {/* Resolved Markets */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold/60">Resolved</h3>
        <MarketsList marketFilters={resolvedFilters} />
      </div>
    </div>
  );
};

/**
 * Markets view for the landing page v2.
 * LIVE tab: Shows open/active prediction markets
 * PAST tab: Shows resolvable and resolved prediction markets
 */
export const MarketsView = ({ className }: MarketsViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as MarketsTab) || "live";

  return (
    <MarketsProviders>
      <div className={cn("flex h-full flex-col gap-6", className)}>
        {/* Content based on active tab */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-xl md:p-6">
          {activeTab === "live" ? <LiveMarketsContent /> : <PastMarketsContent />}
        </div>
      </div>
    </MarketsProviders>
  );
};
