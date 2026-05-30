import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { MergedResourcePanel } from "@/ui/features/world/containers/left-facets/merged-resource-panel";
import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";
import { type ID } from "@bibliothecadao/types";
import Factory from "lucide-react/dist/esm/icons/factory";
import { memo, useEffect, useState } from "react";

const AUTOMATION_LABELS: Record<string, string> = { smart: "Smart", idle: "Idle", custom: "Custom" };

/**
 * Header cue: this structure's automation mode (Smart / Idle / Custom), then
 * the countdown to the next automation run. Ticks on its own 1s interval so the
 * whole cockpit + resource panel don't re-render every second.
 */
const AutomationCue = memo(({ structureEntityId }: { structureEntityId: ID }) => {
  const presetId = useAutomationStore((state) => state.realms[String(structureEntityId)]?.presetId);
  const nextRunTimestamp = useAutomationStore((state) => state.nextRunTimestamp);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const label = AUTOMATION_LABELS[presetId ?? "idle"] ?? "Idle";
  const secondsUntilRun = nextRunTimestamp ? Math.max(0, Math.ceil((nextRunTimestamp - nowMs) / 1000)) : null;

  return (
    <span className="flex min-w-[5.75rem] items-center justify-end gap-1.5 whitespace-nowrap tabular-nums">
      <span>{label}</span>
      {secondsUntilRun !== null && (
        <span className="inline-block min-w-[2rem] text-right font-normal text-gold/55">
          · {formatTimeRemaining(secondsUntilRun)}
        </span>
      )}
    </span>
  );
});
AutomationCue.displayName = "AutomationCue";

// Always-on data column for the active owned structure: one merged "Empire"
// panel of resource tokens (production + balance + build), rendered below
// StructureListColumn in the left rail.
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
      cue={<AutomationCue structureEntityId={structureEntityId} />}
      collapsible
    >
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
