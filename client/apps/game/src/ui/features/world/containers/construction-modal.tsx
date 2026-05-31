import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { BUILDABLE_FILTER, StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { type ID } from "@bibliothecadao/types";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import { lazy, memo, Suspense, useCallback, useEffect, useState } from "react";

const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);

interface ConstructionModalProps {
  structureEntityId: ID;
}

const buildAttention = (structure: StructureWithMetadata): boolean => {
  // Empty canvas = obvious next action.
  if (structure.buildingTilesOccupied === 0) return true;
  // Population at capacity = the player can't build more anyway, so don't flag.
  return false;
};

/**
 * Construction modal — shared shell on the outside, shared StructureSidebar on
 * the left, the existing SelectPreviewBuildingMenu on the right. The sidebar
 * lets the player swap focus to any realm/village without leaving the modal;
 * the build menu already resets its internal state when `entityId` changes,
 * so swaps are free.
 *
 * `focusedRealmId` is local — closing the modal returns the player to whatever
 * realm was active before they opened it.
 */
export const ConstructionModal = memo(({ structureEntityId }: ConstructionModalProps) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const close = useCallback(() => setLeftNavigationView(LeftView.None), [setLeftNavigationView]);

  const [focusedRealmId, setFocusedRealmId] = useState<ID>(structureEntityId);

  useEffect(() => {
    setFocusedRealmId(structureEntityId);
  }, [structureEntityId]);

  return (
    <CenteredModalShell title="Build" icon={Hammer} onClose={close} size="xl">
      <div className="grid h-full grid-cols-12 min-h-0">
        <div className="col-span-3 border-r border-gold/15 min-h-0">
          <StructureSidebar
            selectedEntityId={focusedRealmId}
            onSelectStructure={setFocusedRealmId}
            attention={buildAttention}
            filter={BUILDABLE_FILTER}
          />
        </div>
        <div className="col-span-9 min-h-0 overflow-y-auto">
          <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Loading…</div>}>
            <SelectPreviewBuildingMenu entityId={focusedRealmId} />
          </Suspense>
        </div>
      </div>
    </CenteredModalShell>
  );
});

ConstructionModal.displayName = "ConstructionModal";
