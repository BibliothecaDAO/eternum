import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { ExistingArmiesPanel, UnifiedArmyCreationBody } from "@/ui/features/military/components/unified-army-creation-modal";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { type ID } from "@bibliothecadao/types";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useState } from "react";

interface MilitaryModalProps {
  structureEntityId: ID;
}

const MilitaryDeployHeader = ({ focusedRealmId }: { focusedRealmId: ID }) => {
  const detail = useStructureEntityDetail({ structureEntityId: focusedRealmId });
  if (!detail.structure) {
    return (
      <header className="border-b border-gold/15 px-5 py-3">
        <p className={HUD_BODY_MUTED}>Loading structure...</p>
      </header>
    );
  }
  return (
    <header className="flex items-center gap-2 border-b border-gold/15 px-5 py-3">
      <Swords className="h-4 w-4 text-gold" />
      <span className={cn(HUD_LABEL_BRIGHT, "text-gold")}>
        {(detail.structureName ?? "Structure").toUpperCase()}
      </span>
      <span className={cn(HUD_LABEL_BRIGHT, "text-gold/55")}>· Level {detail.structure.base?.level ?? 0}</span>
    </header>
  );
};

/**
 * Military command center — the legacy "Create Field/Defense Army" deploy
 * surface promoted to the canonical screen, with a realm switcher next to it
 * and an in-line list of existing field armies on the ATTACK tab. Right-click
 * on the map and the left HUD button both land here, so the player never has
 * to learn two flows.
 */
export const MilitaryModal = memo(({ structureEntityId }: MilitaryModalProps) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const close = useCallback(() => setLeftNavigationView(LeftView.None), [setLeftNavigationView]);
  const pendingMilitaryAction = useUIStore((state) => state.pendingMilitaryAction);
  const setPendingMilitaryAction = useUIStore((state) => state.setPendingMilitaryAction);

  const [focusedRealmId, setFocusedRealmId] = useState<ID>(structureEntityId);
  const [initialIsExplorer, setInitialIsExplorer] = useState<boolean>(true);
  const [initialGuardSlot, setInitialGuardSlot] = useState<number | undefined>(undefined);
  const [bodyKey, setBodyKey] = useState(0);

  // Follow the global active structure if it changes (chip click outside modal).
  useEffect(() => {
    setFocusedRealmId(structureEntityId);
  }, [structureEntityId]);

  // Right-click priming: pull the targeted realm + intent in, then clear.
  // Bumping bodyKey remounts UnifiedArmyCreationBody so its internal state
  // re-initializes from the new props.
  useEffect(() => {
    if (!pendingMilitaryAction) return;
    setFocusedRealmId(pendingMilitaryAction.structureId as ID);
    setInitialIsExplorer(pendingMilitaryAction.isExplorer);
    setInitialGuardSlot(pendingMilitaryAction.initialGuardSlot);
    setBodyKey((current) => current + 1);
    setPendingMilitaryAction(null);
  }, [pendingMilitaryAction, setPendingMilitaryAction]);

  const handleSelectStructure = useCallback((id: ID) => {
    setFocusedRealmId(id);
    setInitialGuardSlot(undefined);
    // Remount so the body refetches guards + balances + free directions for
    // the newly selected realm and snaps troop count to max for the new state.
    setBodyKey((current) => current + 1);
  }, []);

  // Empty guard slot = attention.
  const attention = useCallback((structure: StructureWithMetadata) => {
    const base = structure.structure?.base;
    const occupied = Number(base?.troop_guard_count ?? 0);
    const max = Number(base?.troop_max_guard_count ?? 0);
    return max > 0 && occupied < max;
  }, []);

  return (
    <CenteredModalShell title="Military" icon={Swords} onClose={close} size="xl">
      <div className="grid h-full grid-cols-12 min-h-0">
        <div className="col-span-3 border-r border-gold/15 min-h-0">
          <StructureSidebar
            selectedEntityId={focusedRealmId}
            onSelectStructure={handleSelectStructure}
            attention={attention}
            title="Your structures"
            statsVariant="military"
            enableCategoryFilter
          />
        </div>
        <div className="col-span-9 flex min-h-0 flex-col">
          <MilitaryDeployHeader focusedRealmId={focusedRealmId} />
          <div className="flex-1 min-h-0 overflow-y-auto">
            <UnifiedArmyCreationBody
              key={bodyKey}
              embedded
              structureId={Number(focusedRealmId)}
              isExplorer={initialIsExplorer}
              initialGuardSlot={initialGuardSlot}
            />
            <div className="px-2 pb-3 pt-1">
              <ExistingArmiesPanel structureId={focusedRealmId} />
            </div>
          </div>
        </div>
      </div>
    </CenteredModalShell>
  );
});

MilitaryModal.displayName = "MilitaryModal";
