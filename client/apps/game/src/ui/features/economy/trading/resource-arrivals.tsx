import { useUIStore } from "@/hooks/store/use-ui-store";
import { StructureArrivals } from "@/ui/features/economy/resources/resource-arrival";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { memo, useEffect, useState } from "react";

export const AllResourceArrivals = memo(
  ({ className = "", hasArrivals = false }: { className?: string; hasArrivals?: boolean }) => {
    const playerStructures = useUIStore((state) => state.playerStructures);
    const { currentBlockTimestamp } = getBlockTimestamp();
    const [now, setNow] = useState(currentBlockTimestamp);

    useEffect(() => {
      if (!hasArrivals || !currentBlockTimestamp || typeof window === "undefined") return;
      setNow(currentBlockTimestamp);
      const interval = window.setInterval(() => setNow((prev) => prev + 1), 1000);
      return () => window.clearInterval(interval);
    }, [hasArrivals, currentBlockTimestamp]);

    if (!hasArrivals) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center ">
            <p className="text-lg font-medium mb-2">No resource arrivals</p>
            <p className="text-sm">There are no incoming resources</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
        {playerStructures.map((structure) => (
          <StructureArrivals key={structure.entityId} structure={structure} now={now} />
        ))}
      </div>
    );
  },
);
