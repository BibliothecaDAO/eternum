import { StructureWorkspace } from "@/ui/design-system/molecules/structure-workspace";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import {
  ExistingArmiesPanel,
  UnifiedArmyCreationBody,
} from "@/ui/features/military/components/unified-army-creation-modal";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { Direction, type ID } from "@bibliothecadao/types";
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
      <span className={cn(HUD_LABEL_BRIGHT, "text-gold")}>{(detail.structureName ?? "Structure").toUpperCase()}</span>
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
  const [initialDirection, setInitialDirection] = useState<Direction | undefined>(undefined);
  const [initialGuardSlot, setInitialGuardSlot] = useState<number | undefined>(undefined);
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
    setBodyKey((current) => current + 1);
    setPendingMilitaryAction(null);
  }, [pendingMilitaryAction, setPendingMilitaryAction]);

  const handleSelectStructure = useCallback((id: ID) => {
    setFocusedRealmId(id);
    setInitialDirection(undefined);
    setInitialGuardSlot(undefined);
    // Remount so the body refetches guards + balances + free directions for
    // the newly selected realm and snaps troop count to max for the new state.
    setBodyKey((current) => current + 1);
  }, []);

  // Empty guard slot = attention.
  const attention = useCallback((structure: StructureWithMetadata) => {
    const base = structure.structure?.base;
    const occupied = structure.guardCount;
    const max = Number(base?.troop_max_guard_count ?? 0);
    return max > 0 && occupied < max;
  }, []);

  return (
    <SurfaceFrame
      title="Military"
      icon={Swords}
      onClose={close}
      className={SURFACE_WORKSPACE_CLASS}
      bodyClassName="overflow-hidden"
    >
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
        <div className="hidden lg:block">
          <MilitaryDeployHeader focusedRealmId={focusedRealmId} />
        </div>
        <div
          className="flex shrink-0 gap-2 border-b border-gold/15 px-2 lg:hidden"
          role="tablist"
          aria-label="Military view"
        >
          {(["deploy", "armies"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={cn("min-h-11 flex-1 rounded text-sm", mobileTab === tab && "bg-gold/15 text-gold")}
            >
              {tab === "deploy" ? "Deploy" : "Existing armies"}
            </button>
          ))}
        </div>
        <div
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", mobileTab !== "deploy" && "max-lg:hidden")}
        >
          <UnifiedArmyCreationBody
            key={bodyKey}
            embedded
            structureId={Number(focusedRealmId)}
            isExplorer={initialIsExplorer}
            direction={initialDirection}
            initialGuardSlot={initialGuardSlot}
          />
        </div>
        <div
          className={cn(
            "min-h-0 overflow-y-auto p-2 lg:max-h-[240px] lg:shrink-0",
            mobileTab === "armies" ? "max-lg:flex-1" : "max-lg:hidden",
          )}
        >
          <ExistingArmiesPanel structureId={focusedRealmId} />
        </div>
      </StructureWorkspace>
    </SurfaceFrame>
  );
});

MilitaryModal.displayName = "MilitaryModal";
