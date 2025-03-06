import { ResourceArrival } from "@/ui/components/entities/entity";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { useArrivalsByStructure, usePlayerStructures } from "@bibliothecadao/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useState } from "react";

export const AllResourceArrivals = memo(({ className = "" }: { className?: string }) => {
  const playerStructures = usePlayerStructures();

  const [expandedStructures, setExpandedStructures] = useState<Record<string, boolean>>({});

  const toggleStructure = (structureId: string) => {
    setExpandedStructures((prev) => ({
      ...prev,
      [structureId]: !prev[structureId],
    }));
  };

  return (
    <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
      <Headline>
        <div className="flex gap-2">
          <div className="self-center">Transfers</div>
          <HintModalButton section={HintSection.Transfers} />
        </div>
      </Headline>

      {playerStructures.map((structure) => {
        const isExpanded = expandedStructures[structure.entityId] === false;
        const arrivals = useArrivalsByStructure({ structureEntityId: structure.entityId });
        if (arrivals.length === 0) return null;

        return (
          <div key={structure.entityId} className="border border-gold/20 rounded-md">
            <div
              className="flex justify-between items-center p-2 bg-gold/10 cursor-pointer"
              onClick={() => toggleStructure(structure.entityId.toString())}
            >
              <h3 className="text-gold font-medium">{structure.name}</h3>
              <div className="text-gold">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
            </div>

            {isExpanded && (
              <div className="flex flex-col gap-2 p-2">
                {arrivals.map((arrival) => (
                  <ResourceArrival
                    arrival={arrival}
                    key={`${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
