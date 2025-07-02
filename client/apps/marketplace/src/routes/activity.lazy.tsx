import { FullPageLoader } from "@/components/modules/full-page-loader";
import { Button } from "@/components/ui/button";
import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import { ScrollHeader } from "@/components/ui/scroll-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchMarketOrderEvents } from "@/hooks/services";
import { formatRelativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Clock, Loader2, Pencil, ShoppingCart, Tag, X } from "lucide-react";
import { Suspense, useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/activity")({
  component: ActivityPage,
  pendingComponent: FullPageLoader,
});

function ActivityPage() {
  const [filterType, setFilterType] = useState<"all" | "sales" | "listings">("all");

  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["marketOrderEvents", filterType],
    queryFn: () => fetchMarketOrderEvents("", filterType),
    refetchInterval: 30_000,
  });
  // Function to get display status
  const getDisplayStatus = (status: string) => {
    if (status === "Accepted") return "Sale";
    if (status === "Created") return "Listed";
    return status;
  };
  return (
    <>
      <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
        {isHeaderScrolled ? <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">Activity</h4> : <div></div>}
        <div className="w-full flex justify-end gap-1 sm:gap-2 px-4 items-center">
          Type:
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            className="hidden sm:flex"
            onClick={() => setFilterType("all")}
            title="Filter All"
          >
            All
          </Button>
          <Button
            variant={filterType === "sales" ? "default" : "outline"}
            size="sm"
            className="hidden sm:flex"
            onClick={() => setFilterType("sales")}
            title="Filter Sales"
          >
            Sales
          </Button>
          <Button
            variant={filterType === "listings" ? "default" : "outline"}
            size="sm"
            className="hidden sm:flex"
            onClick={() => setFilterType("listings")}
            title="Filter Listings"
          >
            Listings
          </Button>
        </div>
      </ScrollHeader>

      <div className="flex-1">
        <div className="flex flex-col gap-2 px-2">
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
            ) : events && events.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[750px]">
                    <div className="border-b grid grid-cols-7 w-full text-xs text-muted-foreground">
                      <div className="px-4 py-2 text-left">Status</div>
                      <div className="px-4 py-2 text-left col-span-2">Item</div>
                      <div className="px-4 py-2 text-left">Price</div>
                      <div className="px-4 py-2 text-left">Resources</div>
                      <div className="px-4 py-2 text-right col-span-2">Time</div>
                    </div>

                    {/* Table body */}
                    <div className="w-full">
                      {events.map((event) => {
                        const metadata = event.metadata;
                        const image = metadata?.image || "";
                        const price = event.price
                          ? parseFloat(Number(formatUnits(BigInt(event.price), 18)).toFixed(2)).toLocaleString()
                          : "0";
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
                              {event.executed_at && (
                                <div className="flex items-center justify-end h-full">
                                  <Clock className="w-3 h-3 mr-1" />
                                  <TooltipProvider>
                                    <Tooltip delayDuration={0} defaultOpen={false} disableHoverableContent>
                                      <TooltipTrigger asChild>
                                        <span>{formatRelativeTime(new Date(event.executed_at).getTime() / 1000)}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{new Date(event.executed_at).toLocaleString()}</p>{" "}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">No activity found.</div>
            )}
          </Suspense>
        </div>
      </div>
    </>
  );
}
