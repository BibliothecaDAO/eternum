import { AutomationPresetSwitch } from "@/ui/features/settlement/production/automation-preset-switch";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { MergedResourcePanel } from "@/ui/features/world/containers/left-facets/merged-resource-panel";
import { StructureActionsRow } from "@/ui/features/world/components/actions/structure-actions-row";
import Factory from "lucide-react/dist/esm/icons/factory";
import { memo } from "react";

// Always-on panel for the active owned structure: its action row (Build, Production, Military, Transfer)
// over one merged panel of resource tokens, rendered below StructureListColumn in the left rail.
export const EmpireCockpit = memo(() => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { structure, resources, isMine, isLoadingStructure, typeLabel, relicEffects } = useStructureEntityDetail({
    structureEntityId,
  });
  const productionSummary = useStructureProductionSummary(structure, resources);
  const activeRelicIds = relicEffects.map((effect) => Number(effect.id));

  // Hide cockpit when there's nothing meaningful to show — keeps the rail
  // clean during loads and on non-owned selections.
  if (isLoadingStructure) return null;
  if (!structure || !isMine) return null;

  return (
    // Title is the structure's own type (Realm / Village / Camp / …) rather than
    // a generic "Empire" — it names exactly what the token panel is showing.
    <InfoBubble
      title={typeLabel ?? "Structure"}
      icon={Factory}
      cue={
        <AutomationPresetSwitch
          entityId={structureEntityId}
          entityType={isVillageLikeStructureCategory(structure.base.category) ? "village" : "realm"}
        />
      }
      collapsible
    >
      <StructureActionsRow structureEntityId={structureEntityId} />
      <MergedResourcePanel
        structureEntityId={structureEntityId}
        resources={resources}
        productionSummary={productionSummary}
        canBuild={false}
        isMine={isMine}
        activeRelicIds={activeRelicIds}
      />
    </InfoBubble>
  );
});

EmpireCockpit.displayName = "EmpireCockpit";
