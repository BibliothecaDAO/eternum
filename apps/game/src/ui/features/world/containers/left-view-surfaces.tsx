import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resolveLeftViewSurface } from "./left-view-policy";
import { LeftView } from "@/types";
import { PopoverPanel, SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { ConstructionModal } from "@/ui/features/world/containers/construction-modal";
import { LogisticsView } from "@/ui/features/world/containers/logistics-view";
import { MilitaryModal } from "@/ui/features/world/containers/military-modal";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import { setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import { memo, useCallback } from "react";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";

/**
 * The view surfaces — `leftNavigationView` is their open state; each is one popover panel whose frame (header
 * strip, close) is the shared one. The work surfaces hang from the top centre on every layout, desktop or compact.
 */
export const LeftViewSurfaces = memo(() => {
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!ordersAllowed) return null;
  return (
    <>
      <ActiveViewSurface />
      <StructureEditSurface />
    </>
  );
});

LeftViewSurfaces.displayName = "LeftViewSurfaces";

const ActiveViewSurface = () => {
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const surface = useUIStore((state) => resolveLeftViewSurface(state.leftNavigationView));
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  // Esc handling lives inside each view's popover panel, so we don't double-bind it here.
  const closeView = useCallback(() => setView(LeftView.None), [setView]);

  if (surface === "build") {
    return (
      <PopoverPanel
        id="build"
        ariaLabel="Build"
        anchor="top-center"
        rememberPosition
        className="w-auto p-0"
        onDismiss={closeView}
      >
        <ConstructionModal structureEntityId={structureEntityId} />
      </PopoverPanel>
    );
  }
  if (surface === "logistics") {
    return (
      <PopoverPanel
        id="logistics"
        ariaLabel="Logistics"
        anchor="top-center"
        rememberPosition
        className="w-auto p-0"
        onDismiss={closeView}
      >
        <SurfaceFrame
          title="Logistics"
          icon={PackageIcon}
          onClose={closeView}
          className={SURFACE_WORKSPACE_CLASS}
          bodyClassName="overflow-hidden"
        >
          <LogisticsView hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
        </SurfaceFrame>
      </PopoverPanel>
    );
  }
  if (surface === "military") {
    return (
      <PopoverPanel
        id="military"
        ariaLabel="Military"
        anchor="top-center"
        rememberPosition
        className="w-auto p-0"
        onDismiss={closeView}
      >
        <MilitaryModal structureEntityId={structureEntityId} />
      </PopoverPanel>
    );
  }
  return null;
};

const StructureEditSurface = () => {
  const { setup } = useDojo();
  const mode = useGameModeConfig();
  const { structureGroups, updateStructureGroup } = useStructureGroups();
  const pendingRenameStructureEntityId = useUIStore((state) => state.pendingRenameStructureEntityId);
  const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);
  const bumpStructureNameVersion = useUIStore((state) => state.bumpStructureNameVersion);

  const handleNameChange = useCallback(
    (entityId: ID, newName: string) => {
      setEntityNameLocalStorage(entityId, newName);
      setPendingRenameStructureEntityId(null);
      bumpStructureNameVersion();
    },
    [bumpStructureNameVersion, setPendingRenameStructureEntityId],
  );

  const pendingRenameStructure = useComponentValue(
    setup.components.Structure,
    pendingRenameStructureEntityId ? gameEntityKey([BigInt(pendingRenameStructureEntityId)]) : undefined,
  );
  const pendingRenameMetadata = pendingRenameStructure ? mode.structure.getName(pendingRenameStructure) : null;
  const editingStructureId = pendingRenameStructureEntityId !== null ? Number(pendingRenameStructureEntityId) : null;

  if (pendingRenameStructureEntityId === null || !pendingRenameMetadata || editingStructureId === null) return null;

  return (
    <PopoverPanel
      id="structure-edit"
      ariaLabel="Edit structure"
      anchor="top-center"
      className="w-auto p-0"
      onDismiss={() => setPendingRenameStructureEntityId(null)}
    >
      <StructureEditPopup
        currentName={pendingRenameMetadata.name}
        originalName={pendingRenameMetadata.originalName ?? pendingRenameMetadata.name}
        groupColor={structureGroups[editingStructureId] ?? null}
        onConfirm={(newName) => handleNameChange(editingStructureId, newName)}
        onCancel={() => setPendingRenameStructureEntityId(null)}
        onUpdateColor={(color) => updateStructureGroup(editingStructureId, color)}
      />
    </PopoverPanel>
  );
};
