import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import Button from "@/ui/elements/Button";
import { Checkbox } from "@/ui/elements/Checkbox";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { memo, useEffect, useState } from "react";
import { EntityArrival } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

const DISPLAYED_ARRIVALS = 3;

export const AllResourceArrivals = memo(
  ({ arrivals, className = "" }: { arrivals: ArrivalInfo[]; className?: string }) => {
    const dojo = useDojo();
    const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
    const [displayCount, setDisplayCount] = useState(DISPLAYED_ARRIVALS);
    const [showOnlyArrived, setShowOnlyArrived] = useState(true);

    const { nextBlockTimestamp } = useNextBlockTimestamp();

    useEffect(() => {
      // Create a single Set from newIds for O(1) lookup
      const newIdsSet = new Set(arrivals.map((arrival) => arrival.entityId.toString()));

      // Find ids that aren't already subscribed
      const unsubscribedIds = Array.from(newIdsSet).filter((id) => !subscribedIds.has(id));

      if (unsubscribedIds.length === 0) return;

      // Batch the state update with the API call
      setSubscribedIds((prev) => {
        // If nothing changed, return the previous state to prevent re-render
        if (unsubscribedIds.every((id) => prev.has(id))) return prev;
        return new Set([...prev, ...unsubscribedIds]);
      });

      // Move API call outside of state updates
      addToSubscription(dojo.network.toriiClient, dojo.network.contractComponents as any, unsubscribedIds).catch(
        (error) => console.error("Fetch failed", error),
      );
      console.log("AddToSubscriptionStart - 5");
    }, [arrivals, subscribedIds]);

    const filteredArrivals = showOnlyArrived
      ? arrivals.filter((arrival) => arrival.arrivesAt < nextBlockTimestamp)
      : arrivals;

    const displayedArrivals = filteredArrivals.slice(0, displayCount);
    const hasMore = displayCount < filteredArrivals.length;

    const loadMore = () => {
      setDisplayCount((prev) => Math.min(prev + DISPLAYED_ARRIVALS, filteredArrivals.length));
    };

    return (
      <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
        <Headline>
          <div className="flex gap-2">
            <div className="self-center">Transfers</div>
            <HintModalButton section={HintSection.Transfers} />
          </div>
        </Headline>
        <div className="px-2 pb-2">
          <label className="flex items-center space-x-1 text-xs">
            <Checkbox enabled={showOnlyArrived} onClick={() => setShowOnlyArrived(!showOnlyArrived)} />
            <span>Show only arrived</span>
          </label>
        </div>
        {displayedArrivals.map((arrival) => (
          <EntityArrival arrival={arrival} key={arrival.entityId} />
        ))}
        {hasMore && (
          <div className="text-center py-4">
            <Button onClick={loadMore} variant="default" size="xs">
              Load More
            </Button>
          </div>
        )}
      </div>
    );
  },
);
