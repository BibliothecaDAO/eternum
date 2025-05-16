import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { memo } from "react";
import { StructureArrivals } from "../resources/resource-arrival";

export const AllResourceArrivals = memo(({ className = "" }: { className?: string }) => {
  const playerStructures = useUIStore((state) => state.playerStructures);

  return (
    <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
      <Headline>
        <div className="flex gap-2">
          <div className="self-center">Transfers</div>
          <HintModalButton section={HintSection.Transfers} />
        </div>
      </Headline>

      {playerStructures.map((structure) => (
        <StructureArrivals key={structure.entityId} structure={structure} />
      ))}
    </div>
  );
});
