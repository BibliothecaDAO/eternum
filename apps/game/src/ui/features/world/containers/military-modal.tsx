import { realmLevelNumber } from "@/ui/lib/realm-level";
import { StructureWorkspace } from "@/ui/design-system/molecules/structure-workspace";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudLoading, HudTabs, HudWindow } from "@/ui/design-system/kit/hud-elements";
import {
  ExistingArmiesPanel,
  UnifiedArmyCreationBody,
} from "@/ui/features/military/components/unified-army-creation-modal";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { Direction, type ID } from "@bibliothecadao/types";

import { memo, useCallback, useEffect, useState } from "react";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

interface MilitaryModalProps {
  structureEntityId: ID;
}

const MILITARY_TABS = [
  { key: "deploy", label: "Deploy" },
  { key: "armies", label: "Existing armies" },
] as const;

/** The structure the form deploys from: its name and level. */
const MilitaryDeployHeader = ({ focusedRealmId }: { focusedRealmId: ID }) => {
  const detail = useStructureEntityDetail({ structureEntityId: focusedRealmId });
  if (!detail.structure) return <HudLoading line="Loading structure..." />;
  return (
    <h3 className="flex items-center gap-2 border-b border-hud-divider pb-2 text-hud-title">
      {detail.structureName ?? "Structure"}
      <span className="text-hud-muted">· Level {realmLevelNumber(detail.structure.base.level)}</span>
    </h3>
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
  const [initialDirection, setInitialDirection] = useState<Direction | undefined>(undefined);
  const [initialGuardSlot, setInitialGuardSlot] = useState<number | undefined>(undefined);
  const [initialTroops, setInitialTroops] = useState<TroopStack | undefined>(undefined);
  const [bodyKey, setBodyKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<"deploy" | "armies">("deploy");

  // Follow the global active structure if it changes (chip click outside modal).
  useEffect(() => {
    setFocusedRealmId(structureEntityId);
    setInitialDirection(undefined);
    setInitialGuardSlot(undefined);
  }, [structureEntityId]);

  // Right-click priming: pull the targeted realm + intent in, then clear.
  // Bumping bodyKey remounts UnifiedArmyCreationBody so its internal state
  // re-initializes from the new props.
  useEffect(() => {
    if (!pendingMilitaryAction) return;
    setMobileTab("deploy");
    setFocusedRealmId(pendingMilitaryAction.structureId as ID);
    setInitialIsExplorer(pendingMilitaryAction.isExplorer);
    setInitialDirection(pendingMilitaryAction.direction);
    setInitialGuardSlot(pendingMilitaryAction.initialGuardSlot);
    setInitialTroops(pendingMilitaryAction.troops);
    setBodyKey((current) => current + 1);
    setPendingMilitaryAction(null);
  }, [pendingMilitaryAction, setPendingMilitaryAction]);

  const handleSelectStructure = useCallback((id: ID) => {
    setFocusedRealmId(id);
    setInitialDirection(undefined);
    setInitialGuardSlot(undefined);
    setInitialTroops(undefined);
    // Remount so the body refetches guards + balances + free directions for
    // the newly selected realm and snaps troop count to max for the new state.
    setBodyKey((current) => current + 1);
  }, []);

  // Empty guard slot = attention.
  const attention = useCallback((structure: StructureWithMetadata) => {
    const occupied = structure.guardCount;
    const max = structure.structure.base.troop_max_guard_count;
    return occupied !== undefined && max > 0 && occupied < max;
  }, []);

  // The desktop shows the form and the armies together; the phone shows the one its tab picks.
  const compact = useCompactLane() !== null;
  const showsDeploy = !compact || mobileTab === "deploy";
  const showsArmies = !compact || mobileTab === "armies";

  return (
    <HudWindow title="Military" icon="military" size="workspace" onClose={close}>
      <StructureWorkspace
        sidebar={
          <StructureSidebar
            selectedEntityId={focusedRealmId}
            onSelectStructure={handleSelectStructure}
            attention={attention}
            title="Your structures"
            statsVariant="military"
            enableCategoryFilter
          />
        }
      >
        {compact ? (
          <div className="shrink-0" aria-label="Military view">
            <HudTabs tabs={MILITARY_TABS} value={mobileTab} onChange={setMobileTab} />
          </div>
        ) : (
          <MilitaryDeployHeader focusedRealmId={focusedRealmId} />
        )}
        {/* The form stays mounted to keep its draft, and draws itself and its Deploy only where it is shown. */}
        <div className={cn(showsDeploy && "min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
          <UnifiedArmyCreationBody
            key={bodyKey}
            shown={showsDeploy}
            structureId={safeInteger(focusedRealmId)}
            isExplorer={initialIsExplorer}
            direction={initialDirection}
            initialGuardSlot={initialGuardSlot}
            initialTroops={initialTroops}
          />
        </div>
        {showsArmies && (
          <div className={cn("min-h-0 overflow-y-auto pt-2", compact ? "flex-1" : "max-h-hud-section shrink-0")}>
            <ExistingArmiesPanel structureId={focusedRealmId} />
          </div>
        )}
      </StructureWorkspace>
    </HudWindow>
  );
});

MilitaryModal.displayName = "MilitaryModal";
