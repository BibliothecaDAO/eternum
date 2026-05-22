import { HUD_BODY_MUTED } from "@/ui/design-system/atoms/hud-typography";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { ID } from "@bibliothecadao/types";
import Shield from "lucide-react/dist/esm/icons/shield";
import { memo, useMemo } from "react";

interface MilitaryFacetProps {
  structureEntityId: ID;
}

export const MilitaryFacet = memo(({ structureEntityId }: MilitaryFacetProps) => {
  const detail = useStructureEntityDetail({ structureEntityId });

  const occupiedGuardSlots = useMemo(
    () => detail.guards.filter((guard) => Number(guard.troops?.count ?? 0) > 0).length,
    [detail.guards],
  );

  if (!detail.structure) return null;

  const guardCue =
    detail.guardSlotsMax !== undefined ? `${occupiedGuardSlots}/${detail.guardSlotsMax}` : `${occupiedGuardSlots}`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <InfoBubble title="Guards" icon={Shield} cue={guardCue}>
        {detail.guards.length > 0 || (detail.guardSlotsMax ?? 0) > 0 ? (
          <CompactDefenseDisplay
            troops={detail.guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
            slotsUsed={detail.guardSlotsUsed}
            slotsMax={detail.guardSlotsMax}
            structureId={Number(detail.structure.entity_id ?? 0)}
            canManageDefense={detail.isMine}
            variant="banner"
          />
        ) : (
          <p className={HUD_BODY_MUTED}>No defenders stationed.</p>
        )}
      </InfoBubble>
    </div>
  );
});

MilitaryFacet.displayName = "MilitaryFacet";
