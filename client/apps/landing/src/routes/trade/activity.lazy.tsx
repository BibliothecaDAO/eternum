import { FullPageLoader } from "@/components/modules/full-page-loader";
import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { seasonPassAddress } from "@/config";
import { fetchActiveMarketOrdersTotal, fetchMarketOrderEvents } from "@/hooks/services";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { Clock, Loader2, Pencil, ShoppingCart, Tag, X } from "lucide-react";
import { Suspense, useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/trade/activity")({
  component: ActivityPage,
  pendingComponent: FullPageLoader,
});

// Format relative time (e.g. "5 minutes ago", "2 hours ago", etc.)
function formatRelativeTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return "N/A";

  // Convert to date objects for both timestamps
  const date = new Date(timestamp);
  const now = new Date();

  // Calculate time difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function ActivityPage() {
  const [activeTab, setActiveTab] = useState("activity");

  const { data: totals } = useQuery({
    queryKey: ["activeMarketOrdersTotal", seasonPassAddress],
    queryFn: () => fetchActiveMarketOrdersTotal(seasonPassAddress),
    refetchInterval: 30_000,
  });

  const { data: marketEvents, isLoading } = useQuery({
    queryKey: ["marketOrderEvents", seasonPassAddress],
    queryFn: () => fetchMarketOrderEvents(seasonPassAddress, 50, 0),
    refetchInterval: 30_000,
  });

  const activeOrders = totals?.[0]?.active_order_count ?? 0;
  const totalWeiStr = BigInt(totals?.[0]?.open_orders_total_wei ?? 0);
  const totalWei = formatUnits(totalWeiStr, 18);
  const totalEth = totalWei ?? "0";

  // Function to get display status
  const getDisplayStatus = (status: string) => {
    if (status === "Accepted") return "Sale";
    if (status === "Created") return "Listed";
    return status;
  };

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
            <Tabs defaultValue="activity" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="items" asChild>
                  <Link to="/trade" className="cursor-pointer">
                    Items
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="activity" asChild>
                  <Link to="/trade/activity" className="cursor-pointer">
                    Activity
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Activity Content */}
        <div className="container mx-auto py-6">
          <h3 className="text-xl font-semibold mb-4">Recent Market Activity</h3>

          <Suspense
            fallback={
              <div className="flex-grow flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
            }
          >
            {isLoading ? (
              <div className="flex-grow flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
            ) : marketEvents && marketEvents.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table header */}
                <div className="border-b grid grid-cols-7 w-full text-xs text-muted-foreground">
                  <div className="px-4 py-2 text-left">Status</div>
                  <div className="px-4 py-2 text-left col-span-2">Item</div>
                  <div className="px-4 py-2 text-left">Price</div>
                  <div className="px-4 py-2 text-left">Resources</div>
                  <div className="px-4 py-2 text-right col-span-2">Time</div>
                </div>

                {/* Table body */}
                <div className="w-full">
                  {marketEvents.map((event) => {
                    const metadata = event.metadata;
                    const image = metadata?.image || "";
                    const price = event.price ? formatUnits(BigInt(event.price), 18) : "0";
                    const displayStatus = getDisplayStatus(event.state);

                    // Set status color based on state
                    let statusColor = "text-muted-foreground";
                    if (event.state === "Accepted") statusColor = "text-green-500";
                    else if (event.state === "Created") statusColor = "text-amber-500";

                    return (
                      <div
                        key={event.event_id}
                        className="border-b hover:bg-card/80 transition-colors grid grid-cols-7 w-full"
                      >
                        {/* Status */}
                        <div className="px-4 py-3">
                          <div className="flex items-center text-lg h-full">
                            {event.state === "Accepted" ? (
                              <ShoppingCart className="w-5 h-5 text-green-500 mr-3" />
                            ) : event.state === "Created" ? (
                              <Tag className="w-5 h-5 text-amber-500 mr-3" />
                            ) : event.state === "Cancelled" ? (
                              <X className="w-5 h-5 text-amber-500 mr-3" />
                            ) : (
                              <Pencil className="w-5 h-5 text-muted-foreground mr-3" />
                            )}
                            <span className={`font-medium ${statusColor}`}>{displayStatus}</span>
                          </div>
                        </div>

                        {/* Item */}
                        <div className="px-4 py-3  col-span-2">
                          <div className="flex items-center h-full">
                            <div className="w-10 h-10 rounded-md overflow-hidden mr-3">
                              {image ? (
                                <img
                                  src={image}
                                  alt={`Pass #${event.token_id}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No Image</span>
                                </div>
                              )}
                            </div>
                            <span className="font-medium">
                              {event.metadata?.name} #{parseInt(event.token_id, 16)}
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="px-4 py-3 text-left">
                          <div className="flex items-center  h-full">
                            <span className="font-semibold mr-1">{price}</span>
                            <ResourceIcon resource="Lords" size="sm" />
                          </div>
                        </div>

                        {/* Resources */}
                        <div className="px-4 py-3 text-left col-span-2">
                          <div className="flex flex-wrap gap-2 mb-2 h-full items-center">
                            {metadata?.attributes
                              ?.filter((attribute) => attribute.trait_type === "Resource")
                              .map((attribute, index) => (
                                <ResourceIcon
                                  resource={attribute.value as string}
                                  size="sm"
                                  key={`${attribute.trait_type}-${index}`}
                                />
                              ))}
                          </div>
                        </div>

                        {/* Time */}
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                          <div className="flex items-center justify-end h-full">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatRelativeTime(event.executed_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent market activity found.</div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
