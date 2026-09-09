import { SpectatorStandings } from "./spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { ConstructionModal } from "@/ui/features/world/containers/construction-modal";
import { LogisticsView } from "@/ui/features/world/containers/logistics-view";
import { MilitaryModal } from "@/ui/features/world/containers/military-modal";
import { EmpireCockpit } from "@/ui/features/world/containers/left-facets/empire-cockpit";
import { StructureListColumn } from "@/ui/features/world/containers/left-facets/structure-list-column";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import { setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import { memo, useCallback } from "react";
import { gameEntityKey } from "@/sync/game-scope";

export const LeftCommandSidebar = memo(() => {
  const { setup } = useDojo();
  const components = setup.components;

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { structureGroups, updateStructureGroup } = useStructureGroups();
  const mode = useGameModeConfig();

  const pendingRenameStructureEntityId = useUIStore((state) => state.pendingRenameStructureEntityId);
  const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);
  const bumpStructureNameVersion = useUIStore((state) => state.bumpStructureNameVersion);
  const ordersAllowed = useUIStore(canIssueOrders);

  const handleNameChange = useCallback(
    (entityId: ID, newName: string) => {
      setEntityNameLocalStorage(entityId, newName);
      setPendingRenameStructureEntityId(null);
      bumpStructureNameVersion();
    },
    [bumpStructureNameVersion, setPendingRenameStructureEntityId],
  );

  const isPanelOpen = view !== LeftView.None;
  const closeView = useCallback(() => setView(LeftView.None), [setView]);

  // Esc handling lives inside each view's popover panel now, so we don't
  // double-bind it here.

  const ConnectedAccount = useAccountStore((state) => state.account);

  const pendingRenameStructure = useComponentValue(
    components.Structure,
    pendingRenameStructureEntityId ? gameEntityKey([BigInt(pendingRenameStructureEntityId)]) : undefined,
  );
  const pendingRenameMetadata = pendingRenameStructure ? mode.structure.getName(pendingRenameStructure) : null;
  const editingStructureId = pendingRenameStructureEntityId !== null ? Number(pendingRenameStructureEntityId) : null;

  if (!ordersAllowed) return <SpectatorStandings />;

  return (
    <>
      {/* Left control column — the player's structures and the active one's token panel. The action row
          lives in the tile details of the selected own structure. */}
      {ConnectedAccount && (
        <div
          className={cn(
            "fixed left-3 z-20 pointer-events-auto flex max-h-[calc(100vh-340px)] flex-col gap-2 overflow-y-auto scrollbar-thin",
            HUD_COLUMN_TOP,
            HUD_COLUMN_WIDTH,
          )}
        >
          <StructureListColumn />
          <EmpireCockpit />
        </div>
      )}

      {/* The view surfaces — `leftNavigationView` is their open state; each is one popover panel whose frame
          (header strip, close) is the shared one. The work surfaces hang from the top centre. */}
      {isPanelOpen && view === LeftView.ConstructionView && (
        <PopoverPanel id="build" ariaLabel="Build" anchor="top-center" className="w-auto p-0" onDismiss={closeView}>
          <ConstructionModal structureEntityId={structureEntityId} />
        </PopoverPanel>
      )}
      {isPanelOpen && view === LeftView.ResourceArrivals && (
        <PopoverPanel
          id="logistics"
          ariaLabel="Logistics"
          anchor="top-center"
          className="w-auto p-0"
          onDismiss={closeView}
        >
          <SurfaceFrame
            title="Logistics"
            icon={PackageIcon}
            onClose={closeView}
            className="w-[1320px] h-[calc(100vh-7rem)]"
            bodyClassName="overflow-hidden"
          >
            <LogisticsView hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
          </SurfaceFrame>
        </PopoverPanel>
      )}
      {isPanelOpen && view === LeftView.MilitaryView && (
        <PopoverPanel
          id="military"
          ariaLabel="Military"
          anchor="top-center"
          className="w-auto p-0"
          onDismiss={closeView}
        >
          <MilitaryModal structureEntityId={structureEntityId} />
        </PopoverPanel>
      )}

      {pendingRenameStructureEntityId !== null && pendingRenameMetadata && editingStructureId !== null && (
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
      )}
    </>
  );
});

LeftCommandSidebar.displayName = "LeftCommandSidebar";
