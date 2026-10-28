import { StructureWorkspace } from "@/ui/design-system/molecules/structure-workspace";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { HudLoading, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import { categoriesThatCan } from "@/ui/lib/structure-capabilities";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { type ID } from "@bibliothecadao/types";

import { lazy, memo, Suspense, useCallback, useEffect, useState } from "react";

/** The structures that build: the Build window lists only these. */
const BUILDERS = categoriesThatCan("builds");

const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement/construction/select-preview-building").then((module) => ({
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
    <HudWindow title="Build" icon="build" size="workspace" onClose={close}>
      <StructureWorkspace
        sidebar={
          <StructureSidebar
            selectedEntityId={focusedRealmId}
            onSelectStructure={setFocusedRealmId}
            attention={buildAttention}
            filter={BUILDERS}
          />
        }
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <Suspense fallback={<HudLoading line="Loading…" />}>
            <SelectPreviewBuildingMenu entityId={focusedRealmId} />
          </Suspense>
        </div>
      </StructureWorkspace>
    </HudWindow>
  );
});

ConstructionModal.displayName = "ConstructionModal";
