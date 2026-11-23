import { HudEmpty } from "@/ui/design-system/kit/hud-elements";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { StructureArrivals } from "@/ui/features/economy/resources/resource-arrival";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { memo } from "react";

export const AllResourceArrivals = memo(
  ({ className = "", hasArrivals = false }: { className?: string; hasArrivals?: boolean }) => {
    const playerStructures = useFactView(playerStructuresView);
    const { currentBlockTimestamp } = getBlockTimestamp();
    const now = currentBlockTimestamp;

    if (!hasArrivals) return <HudEmpty icon="resources" line="No incoming transfers" />;

    return (
      <div className={`flex flex-col gap-3 overflow-y-auto ${className}`}>
        {playerStructures.map((structure) => (
          <StructureArrivals key={structure.entityId} structure={structure} now={now} />
        ))}
      </div>
    );
  },
);
