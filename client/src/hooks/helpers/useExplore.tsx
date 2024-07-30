import { Resource } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";
import { useDojo } from "../context/DojoContext";

export function useExplore() {
  const {
    setup: {
      updates: {
        eventUpdates: { createExploreEntityMapEvents: exploreEntityMapEvents },
      },
    },
  } = useDojo();

  const useFoundResources = (entityId: bigint | undefined) => {
    const [foundResources, setFoundResources] = useState<Resource | undefined>();

    const subscriptionRef = useRef<Subscription | undefined>();
    const isComponentMounted = useRef(true);

    useEffect(() => {
      if (!entityId) return;
      const subscribeToFoundResources = async () => {
        const observable = await exploreEntityMapEvents(entityId);
        const subscription = observable.subscribe((event) => {
          if (!isComponentMounted.current) return;
          if (event) {
            const resourceId = Number(event.data[3]);
            const amount = Number(event.data[4]);
            setFoundResources({ resourceId, amount });
          }
        });
        subscriptionRef.current = subscription;
      };
      subscribeToFoundResources();

      // Cleanup function
      return () => {
        isComponentMounted.current = false;
        subscriptionRef.current?.unsubscribe(); // Ensure to unsubscribe on component unmount
      };
    }, [entityId]);

    return { foundResources, setFoundResources };
  };

  return { useFoundResources };
}
