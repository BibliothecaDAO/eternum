import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { memo, useEffect } from "react";
import { EntityArrival } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

export const AllResourceArrivals = memo(
  ({ arrivals, className = "" }: { arrivals: ArrivalInfo[]; className?: string }) => {
    const dojo = useDojo();

    useEffect(() => {
      const fetch = async () => {
        try {
          await addToSubscription(dojo.network.toriiClient, dojo.network.contractComponents as any, [
            ...arrivals.map((arrival) => arrival.entityId.toString()),
          ]);
        } catch (error) {
          console.error("Fetch failed", error);
        }
      };
      fetch();
    }, [arrivals, dojo.network.toriiClient, dojo.network.contractComponents]);

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
