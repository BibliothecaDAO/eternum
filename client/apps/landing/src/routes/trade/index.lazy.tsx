import { FullPageLoader } from "@/components/modules/full-page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { marketplaceCollections } from "@/config";
import { fetchActiveMarketOrdersTotal } from "@/hooks/services";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/trade/$collection/")({
  component: CollectionsPage,
  pendingComponent: FullPageLoader,
});

function CollectionsPage() {
  const collections = Object.entries(marketplaceCollections);
  console.log(collections);
  const queries = collections.map(([key, collection]) => ({
    queryKey: ["activeMarketOrdersTotal", key],
    queryFn: () => fetchActiveMarketOrdersTotal(collection.address),
    refetchInterval: 30_000,
  }));

  const results = useSuspenseQueries({
    queries,
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Marketplace Collections</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map(([key, collection], index) => {
          const stats = results[index].data?.[0];
          const activeOrders = stats?.active_order_count ?? 0;
          const totalVolume = stats?.open_orders_total_wei ? formatUnits(BigInt(stats.open_orders_total_wei), 18) : "0";

          return (
            <Card key={key} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="capitalize">{key.replace(/-/g, " ")}</CardTitle>
                <CardDescription>Collection Address: {collection.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Listings:</span>
                    <span className="font-medium">{activeOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Volume:</span>
                    <span className="font-medium">{totalVolume} Lords</span>
                  </div>
                  <Button className="w-full mt-4" asChild>
                    <a href={`/trade/${key}`}>View Collection</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
