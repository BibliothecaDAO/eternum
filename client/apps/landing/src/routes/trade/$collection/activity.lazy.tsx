import { FullPageLoader } from "@/components/modules/full-page-loader";
import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import { ScrollHeader } from "@/components/ui/scroll-header";
import { fetchMarketOrderEvents } from "@/hooks/services";
import { formatRelativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Clock, Loader2, Pencil, ShoppingCart, Tag, X } from "lucide-react";
import { Suspense, useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/trade/$collection/activity")({
  component: ActivityPage,
  pendingComponent: FullPageLoader,
});

function ActivityPage() {
  const { collection } = Route.useParams();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["marketOrderEvents", collection],
    queryFn: () => fetchMarketOrderEvents(collection),
    refetchInterval: 30_000,
  });

  return (
    <>
      <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
        {isHeaderScrolled ? <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">Activity</h4> : <div></div>}
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
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      {event.event_type === "LIST" && <Tag className="h-5 w-5 text-blue-500" />}
                      {event.event_type === "EDIT" && <Pencil className="h-5 w-5 text-yellow-500" />}
                      {event.event_type === "CANCEL" && <X className="h-5 w-5 text-red-500" />}
                      {event.event_type === "PURCHASE" && <ShoppingCart className="h-5 w-5 text-green-500" />}
                      <div>
                        <div className="font-medium">
                          {event.event_type === "LIST" && "Listed"}
                          {event.event_type === "EDIT" && "Price Updated"}
                          {event.event_type === "CANCEL" && "Listing Cancelled"}
                          {event.event_type === "PURCHASE" && "Purchased"}
                        </div>
                        <div className="text-sm text-muted-foreground">Token ID: {event.token_id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {event.price && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {formatUnits(BigInt(event.price), 18)} <ResourceIcon resource="Lords" size="sm" />
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatRelativeTime(event.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
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
