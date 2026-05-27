import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { ConstructionModal } from "@/ui/features/world/containers/construction-modal";
import { LogisticsView } from "@/ui/features/world/containers/logistics-view";
import { MilitaryModal } from "@/ui/features/world/containers/military-modal";
import { EmpireCockpit } from "@/ui/features/world/containers/left-facets/empire-cockpit";
import { StructureListColumn } from "@/ui/features/world/containers/left-facets/structure-list-column";
import {
  RealtimeChatShell,
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  type InitializeRealtimeClientParams,
} from "@/ui/features/social";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import { setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo } from "react";

// ----------------------------------------------------------------------------
// Realtime chat config hook
// ----------------------------------------------------------------------------

const useRealtimeChatConfig = () => {
  const ConnectedAccount = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);

  const defaultZoneId = "global";
  const zoneIds = useMemo(() => [defaultZoneId], [defaultZoneId]);
  const realtimeBaseUrl = (import.meta.env.VITE_PUBLIC_REALTIME_URL as string | undefined) ?? "";

  const initializer = useMemo<InitializeRealtimeClientParams | null>(() => {
    if (!realtimeBaseUrl) return null;

    const walletAddress = ConnectedAccount?.address ?? undefined;
    const normalizedAccountName = accountName?.trim() ?? "";
    const hasUsername = normalizedAccountName.length > 0;
    const playerId = hasUsername ? normalizedAccountName : (walletAddress ?? "demo-player");
    const displayName = hasUsername ? normalizedAccountName : undefined;

    return {
      baseUrl: realtimeBaseUrl,
      identity: { playerId, walletAddress, displayName },
      queryParams: { walletAddress, playerName: displayName },
      joinZones: zoneIds,
    };
  }, [ConnectedAccount?.address, accountName, realtimeBaseUrl, zoneIds]);

  return { initializer, defaultZoneId, zoneIds };
};

// ----------------------------------------------------------------------------
// Chat shell wrapper — kept here because it shares the realtime config hook
// ----------------------------------------------------------------------------

const ChatModalContent = ({
  initializer,
  zoneIds,
  defaultZoneId,
}: {
  initializer: InitializeRealtimeClientParams | null;
  zoneIds: string[];
  defaultZoneId: string;
}) => {
  if (!initializer) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-gold/70">
        Chat is unavailable. Check your realtime configuration.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <RealtimeChatShell
        initializer={initializer}
        zoneIds={zoneIds}
        defaultZoneId={defaultZoneId}
        autoInitializeClient={false}
        displayMode="embedded"
        showInlineToggle={false}
        className="h-full"
      />
    </div>
  );
};

// ----------------------------------------------------------------------------
// Lazy view components used inside the centered action modal
// ----------------------------------------------------------------------------

const InGameMarket = lazy(() =>
  import("@/ui/features/market").then((module) => ({
    default: module.InGameMarket,
  })),
);

// ----------------------------------------------------------------------------
// LeftCommandSidebar
//
// After the round-3 redesign this component now owns three things:
//   - the always-on LeftStructureColumn (top-anchored bubbles showing the
//     player's active structure — mirrors the right-side tile-details column)
//   - the centered action modal (Build / Transfer / Chat / Prediction Market)
//     opened by the LeftActionsRow rendered inside BottomRightPanel
//   - the StructureEditPopup mount (rename / group color)
//
// The previous vertical view-switcher pill strip is gone. Action buttons live
// above the minimap and trigger the same `leftNavigationView` state, but the
// destination is now a true centered modal rather than a side panel.
// ----------------------------------------------------------------------------

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

  const handleNameChange = useCallback(
    (entityId: ID, newName: string) => {
      setEntityNameLocalStorage(entityId, newName);
      setPendingRenameStructureEntityId(null);
      bumpStructureNameVersion();
    },
    [bumpStructureNameVersion, setPendingRenameStructureEntityId],
  );

  const {
    initializer: realtimeInitializer,
    defaultZoneId: chatDefaultZoneId,
    zoneIds: chatZoneIds,
  } = useRealtimeChatConfig();
  useRealtimeChatInitializer(realtimeInitializer);
  const chatActions = useRealtimeChatActions();
  const isChatOpen = useRealtimeChatSelector((state) => state.isShellOpen);

  // Track chat shell open/close against the leftNavigationView so the
  // RealtimeChatShell internal state stays in sync with the modal lifecycle.
  useEffect(() => {
    if (view === LeftView.ChatView) {
      chatActions.setShellOpen(true);
    } else {
      chatActions.setShellOpen(false);
    }
  }, [chatActions, view]);

  useEffect(() => {
    if (!isChatOpen && view === LeftView.ChatView) {
      setView(LeftView.None);
    }
  }, [isChatOpen, setView, view]);

  const isPanelOpen = view !== LeftView.None;
  const closeView = useCallback(() => setView(LeftView.None), [setView]);

  // Esc handling lives inside each modal's CenteredModalShell now, so we don't
  // double-bind it here.

  const ConnectedAccount = useAccountStore((state) => state.account);

  const pendingRenameStructure = useComponentValue(
    components.Structure,
    pendingRenameStructureEntityId ? getEntityIdFromKeys([BigInt(pendingRenameStructureEntityId)]) : undefined,
  );
  const pendingRenameMetadata = pendingRenameStructure ? mode.structure.getName(pendingRenameStructure) : null;
  const editingStructureId =
    pendingRenameStructureEntityId !== null ? Number(pendingRenameStructureEntityId) : null;

  return (
    <>
      {/* Left control column — always-visible vertical list of all the player's
          structures. The active card expands to show Suggested Actions only.
          Heavier views (Production, Military) live in centered modals
          triggered from the LeftActionsRow above the minimap. */}
      {ConnectedAccount && (
        <div className="fixed left-3 top-3 z-20 pointer-events-auto flex w-[280px] max-h-[calc(100vh-380px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          <StructureListColumn />
          <EmpireCockpit />
        </div>
      )}

      {/* Centered modals — each one renders its own CenteredModalShell so the
          chrome (backdrop, bronze frame, header strip, close button) is the
          same everywhere. We just dispatch by view. */}
      {isPanelOpen && view === LeftView.PredictionMarket && (
        <CenteredModalShell title="Prediction Market" icon={Sparkles} onClose={closeView}>
          <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Loading…</div>}>
            <div className="prediction-market-selector flex h-full min-h-0 flex-col overflow-y-auto">
              <InGameMarket />
            </div>
          </Suspense>
        </CenteredModalShell>
      )}
      {isPanelOpen && view === LeftView.ChatView && (
        <CenteredModalShell title="Chat" icon={MessageCircle} onClose={closeView}>
          <div className="h-full">
            <ChatModalContent
              initializer={realtimeInitializer}
              zoneIds={chatZoneIds}
              defaultZoneId={chatDefaultZoneId}
            />
          </div>
        </CenteredModalShell>
      )}
      {isPanelOpen && view === LeftView.ConstructionView && (
        <ConstructionModal structureEntityId={structureEntityId} />
      )}
      {isPanelOpen && view === LeftView.ResourceArrivals && (
        <CenteredModalShell title="Logistics" icon={PackageIcon} onClose={closeView}>
          <div className="h-full min-h-0 overflow-hidden">
            <LogisticsView hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
          </div>
        </CenteredModalShell>
      )}
      {isPanelOpen && view === LeftView.MilitaryView && (
        <MilitaryModal structureEntityId={structureEntityId} />
      )}

      {pendingRenameStructureEntityId !== null && pendingRenameMetadata && editingStructureId !== null && (
        <StructureEditPopup
          currentName={pendingRenameMetadata.name}
          originalName={pendingRenameMetadata.originalName ?? pendingRenameMetadata.name}
          groupColor={structureGroups[editingStructureId] ?? null}
          onConfirm={(newName) => handleNameChange(editingStructureId, newName)}
          onCancel={() => setPendingRenameStructureEntityId(null)}
          onUpdateColor={(color) => updateStructureGroup(editingStructureId, color)}
        />
      )}
    </>
  );
});

LeftCommandSidebar.displayName = "LeftCommandSidebar";
