import { useUIStore } from "@/hooks/store/use-ui-store";
import { Headline } from "@/ui/design-system/molecules/headline";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { StructureArrivals } from "@/ui/features/economy/resources/resource-arrival";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { memo } from "react";

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
