import { usePlayerArrivals } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { useEffect } from "react";
import { Entity } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

export const AllResourceArrivals = ({ setNotificationLength }: { setNotificationLength: (len: number) => void }) => {
  const arrivals = usePlayerArrivals();

  useEffect(() => {
    const updateNotificationLength = () => {
      const currentTime = Date.now() / 1000;
      const arrivedCount = arrivals.filter((arrival) => arrival.arrivesAt <= currentTime).length;
      setNotificationLength(arrivedCount);
    };

    updateNotificationLength();

    const intervalId = setInterval(updateNotificationLength, 10000);

    return () => clearInterval(intervalId);
  }, [arrivals]);

  return (
    <div className="p-2 flex flex-col space-y-1 overflow-y-auto">
      <Headline>
        {" "}
        <div className="flex gap-2">
          <div className="self-center">Transfers</div>
          <HintModalButton section={HintSection.Transfers} />
        </div>
      </Headline>
      {!arrivals.length && <div className="text-center">No resource arrivals yet.</div>}
      {arrivals.map((arrival) => {
        return <Entity key={arrival.entityId} entityId={arrival.entityId} />;
      })}
    </div>
  );
};
