import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { memo, useEffect, useState } from "react";
import { EntityArrival } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

export const AllResourceArrivals = memo(
  ({ arrivals, className = "" }: { arrivals: ArrivalInfo[]; className?: string }) => {
    const dojo = useDojo();
    const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());

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
      addToSubscription(
        dojo.network.toriiClient,
        dojo.network.contractComponents as any,
        unsubscribedIds,
        dojo.setup.db,
      ).catch((error) => console.error("Fetch failed", error));
    }, [arrivals, subscribedIds]);

    return (
      <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
        <Headline>
          <div className="flex gap-2">
            <div className="self-center">Transfers</div>
            <HintModalButton section={HintSection.Transfers} />
          </div>
        </Headline>
        {arrivals.map((arrival) => (
          <EntityArrival arrival={arrival} key={arrival.entityId} />
        ))}
      </div>
    );
  },
);
