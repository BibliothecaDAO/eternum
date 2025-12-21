import { MarketCard, MarketsProviders } from "@/features/prediction-markets";
import { MarketStatusFilter, MarketTypeFilter, useMarkets } from "@/pm/sdk";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STATUS_TABS = [
  { value: MarketStatusFilter.All, label: "All" },
  { value: MarketStatusFilter.Open, label: "Open" },
  { value: MarketStatusFilter.Resolvable, label: "Resolvable" },
  { value: MarketStatusFilter.Resolved, label: "Resolved" },
];

const MarketsPageContent = () => {
  const [statusFilter, setStatusFilter] = useState<MarketStatusFilter>(MarketStatusFilter.All);
  const [hasLoaded, setHasLoaded] = useState(false);

  const marketFilters = useMemo(
    () => ({
      status: statusFilter,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [statusFilter],
  );

  const { markets, refresh } = useMarkets({ marketFilters });

  useEffect(() => {
    setHasLoaded(true);
  }, [markets]);

  const isLoading = !hasLoaded && markets.length === 0;

  return (
    <div className="min-h-screen space-y-4 bg-gradient-to-br from-background to-muted/20 p-4 pb-24">
      <Card className="space-y-3 border-border/60 bg-card/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Prediction Markets</h1>
            <p className="text-xs text-muted-foreground">Trade on live outcomes for current Blitz games.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh
          </Button>
        </div>

        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as MarketStatusFilter)}>
          <TabsList className="w-full justify-between">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Card>

      {isLoading ? (
        <Card className="border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">Loading markets...</Card>
      ) : markets.length === 0 ? (
        <Card className="border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
          No markets found for this filter.
        </Card>
      ) : (
        <div className="space-y-3">
          {markets.map((market) => (
            <MarketCard key={market.market_id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
};

export const MarketsPage = () => (
  <MarketsProviders>
    <MarketsPageContent />
  </MarketsProviders>
);
