import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marketplaceCollections } from "@/config";
import { fetchCollectionStatistics } from "@/hooks/services";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation, useParams } from "@tanstack/react-router";
import { formatUnits } from "viem";
import { env } from "../../../../env";

export const Route = createFileRoute("/trade/$collection")({
  component: TradeLayout,
  head: ({ params }) => {
    const { collection } = params;
    const collectionConfig = marketplaceCollections[collection as keyof typeof marketplaceCollections];
    const collectionName = collectionConfig?.name || collection;

    return {
      title: `${collectionName} Marketplace | Eternum`,
      meta: [
        {
          name: "description",
          content: `Trade ${collectionName} NFTs on the Realms marketplace. View active listings, floor prices, and trading activity.`,
        },
        {
          property: "og:title",
          content: `${collectionName} Marketplace | Eternum`,
        },
        {
          property: "og:description",
          content: `Trade ${collectionName} NFTs on the Realms marketplace. View active listings, floor prices, and trading activity.`,
        },
        {
          property: "og:image",
          content: `https://empire.realms.world/collections/${collection.toLowerCase()}.png`,
        },
        {
          property: "og:url",
          content: `https://empire.realms.world/trade/${collection}`,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: `${collectionName} Marketplace | Eternum`,
        },
        {
          name: "twitter:description",
          content: `Trade ${collectionName} NFTs on the Realms marketplace. View active listings, floor prices, and trading activity.`,
        },
        {
          name: "twitter:image",
          content: `https://empire.realms.world/collections/${collection.toLowerCase()}.png`,
        },
      ],
    };
  },
});

function TradeLayout() {
  const { collection } = useParams({ from: "/trade/$collection" });
  const collectionAddress = marketplaceCollections[collection as keyof typeof marketplaceCollections].address;
  const collectionName = marketplaceCollections[collection as keyof typeof marketplaceCollections].name;
  const { data: totals } = useQuery({
    queryKey: ["collectionStatistics", collectionAddress],
    queryFn: () => fetchCollectionStatistics(collectionAddress, { useMockup: true }),
    refetchInterval: 30_000,
  });

  const location = useLocation();
  const isItemsTab = location.pathname === "/trade";
  const isSeasonPass = collection === "season-passes";
  const activeOrders = totals?.[0]?.active_order_count ?? 0;
  const totalWeiStr = BigInt(totals?.[0]?.open_orders_total_wei ?? 0);
  const totalWei = formatUnits(totalWeiStr, 18);
  const totalEth = totalWei ?? "0";
  const floorPrice = totals?.[0]?.floor_price_wei ? formatUnits(BigInt(totals?.[0]?.floor_price_wei), 18) : "0";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="text-center border-b py-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">{collectionName + " Marketplace"}</h2>
          <div className="flex justify-center items-center gap-4 text-xl text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{activeOrders}</span> Active Listings
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1">
              Floor Price{" "}
              <span className="font-semibold text-foreground">{parseFloat(floorPrice).toLocaleString()}</span>{" "}
              <ResourceIcon resource="Lords" size="sm" />
            </span>
            <Separator orientation="vertical" className="h-4" />
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
                {!isSeasonPass && (
                  <TabsTrigger className="h3 bg-transparent data-[state=active]:bg-transparent" value="items" asChild>
                    <Link to={collection ? `/trade/$collection` : "/trade"} className="cursor-pointer">
                      Items
                    </Link>
                  </TabsTrigger>
                )}
                <TabsTrigger value="activity" asChild>
                  <Link to={collection ? `/trade/$collection/activity` : "/trade"} className="cursor-pointer">
                    Activity
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {env.VITE_PUBLIC_SHOW_END_GAME_WARNING && isItemsTab && (
          <div className="bg-blue-50/50 dark:bg-blue-950/30 py-6">
            <div className="container mx-auto px-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center border border-blue-400">
                    i
                  </div>
                  <h4 className="text-blue-800 dark:text-blue-300 font-medium text-base">Season Update</h4>
                </div>
                <p className="text-blue-700 dark:text-blue-400 text-base max-w-2xl mx-auto leading-relaxed">
                  The current season has ended and Season 1 Passes can no longer be used in Eternum.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Child route content */}
        <Outlet />
      </div>
    </div>
  );
}
