import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { seasonPassAddress } from "@/config";
import { fetchActiveMarketOrdersTotal } from "@/hooks/services";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { formatUnits } from "viem";

export const Route = createFileRoute("/trade/$collection")({
  component: TradeLayout,
});

function TradeLayout() {
  const { collection } = useParams({ from: "/trade/$collection" });
  const collectionAddress = collection || seasonPassAddress;

  const { data: totals } = useQuery({
    queryKey: ["activeMarketOrdersTotal", collectionAddress],
    queryFn: () => fetchActiveMarketOrdersTotal(collectionAddress),
    refetchInterval: 30_000,
  });

  const activeOrders = totals?.[0]?.active_order_count ?? 0;
  const totalWeiStr = BigInt(totals?.[0]?.open_orders_total_wei ?? 0);
  const totalWei = formatUnits(totalWeiStr, 18);
  const totalEth = totalWei ?? "0";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="text-center border-b py-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">{"Season 1 Pass Marketplace"}</h2>
          <div className="flex justify-center items-center gap-4 text-xl text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{activeOrders}</span> Active Listings
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Volume <span className="font-semibold text-foreground">{parseFloat(totalEth).toLocaleString()}</span>{" "}
              <ResourceIcon resource="Lords" size="sm" />
            </span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b">
          <div className="container mx-auto py-2">
            <Tabs defaultValue="items" className="w-full items-center flex justify-center">
              <TabsList className="grid w-full max-w-md grid-cols-2 bg-transparent uppercase">
                <TabsTrigger className="h3 bg-transparent data-[state=active]:bg-transparent" value="items" asChild>
                  <Link to={collection ? `/trade/${collection}` : "/trade"} className="cursor-pointer">
                    Items
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="activity" asChild>
                  <Link
                    to={collection ? `/trade/${collection}/activity` : "/trade/activity"}
                    className="cursor-pointer"
                  >
                    Activity
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Child route content */}
        <Outlet />
      </div>
    </div>
  );
}
