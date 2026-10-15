import { AutomationPresetSwitch } from "@/ui/features/settlement/production/automation-preset-switch";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { MergedResourcePanel } from "@/ui/features/world/containers/left-facets/merged-resource-panel";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { memo, type ReactNode } from "react";

// Always-on panel for the active owned structure: one merged panel of resource tokens, rendered below the
// actions bubble in the left rail.
export const EmpireCockpit = memo(() => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { structure, resources, isMine, isLoadingStructure, typeLabel, structureName, relicEffects } =
    useStructureEntityDetail({
      structureEntityId,
    });
  const productionSummary = useStructureProductionSummary(structure, resources);
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const activeRelicIds = relicEffects.map((effect) => Number(effect.id));

  // Hide cockpit when there's nothing meaningful to show — keeps the rail
  // clean during loads and on non-owned selections.
  if (isLoadingStructure) return null;
  if (!structure || !isMine) return null;

  return (
    // Title is the structure's own type (Realm / Village / Camp / …) rather than
    // a generic "Empire" — it names exactly what the token panel is showing.
    <EmpireCockpitView
      title={`${structureName} · ${typeLabel ?? "Structure"}`}
      cue={
        showAutomation ? (
          <AutomationPresetSwitch
            entityId={structureEntityId}
            entityType={isVillageLikeStructureCategory(structure.base.category) ? "village" : "realm"}
          />
        ) : undefined
      }
    >
      <MergedResourcePanel
        structureEntityId={structureEntityId}
        resources={resources}
        productionSummary={productionSummary}
        canBuild={false}
        isMine={isMine}
        activeRelicIds={activeRelicIds}
      />
    </EmpireCockpitView>
  );
});

EmpireCockpit.displayName = "EmpireCockpit";

export function EmpireCockpitView({ title, cue, children }: { title: string; cue?: ReactNode; children: ReactNode }) {
  return (
    <section className="realm-panel" data-group="Realm">
      <InfoBubble title={<span data-notice>{title}</span>} cue={cue} collapsible={false}>
        {children}
      </InfoBubble>
    </section>
  );
}
