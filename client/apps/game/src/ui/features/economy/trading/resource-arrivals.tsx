import { useUIStore } from "@/hooks/store/use-ui-store";
import { StructureArrivals } from "@/ui/features/economy/resources/resource-arrival";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import PackageOpen from "lucide-react/dist/esm/icons/package-open";
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
        <div className="h-full flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-gold/40">
            <PackageOpen size={28} strokeWidth={1.5} />
            <p className="text-xs uppercase tracking-widest">No incoming transfers</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`p-3 flex flex-col overflow-y-auto gap-3 ${className}`}>
        <p className="text-[10px] uppercase tracking-wider text-gold/40 px-1">
          Arrived resources are auto-claimed into your structure's balance.
        </p>
        {playerStructures.map((structure) => (
          <StructureArrivals key={structure.entityId} structure={structure} now={now} />
        ))}
      </div>
    );
  },
);
