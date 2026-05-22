import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceArrivals as AllResourceArrivals, MarketModal } from "@/ui/features/economy/trading";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import {
  RealtimeChatShell,
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimeTotals,
  type InitializeRealtimeClientParams,
} from "@/ui/features/social";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { construction, military, trade } from "@/ui/features/world";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, type ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import type { ComponentProps, ReactNode } from "react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type NavigationItem = {
  id: MenuEnum;
  children?: ReactNode;
} & Pick<
  CircleButtonProps,
  | "active"
  | "className"
  | "disabled"
  | "image"
  | "label"
  | "onClick"
  | "primaryNotification"
  | "secondaryNotification"
  | "size"
  | "tooltipLocation"
>;

type RealmNavigationContext = {
  view: LeftView;
  setView: (view: LeftView) => void;
  disableButtons: boolean;
  canOpenConstruction: boolean;
  arrivedArrivalsNumber: number;
  pendingArrivalsNumber: number;
  toggleModal: (content: ReactNode | null) => void;
  isTradeOpen: boolean;
  showTradeMenu: boolean;
};

type EconomyNavigationContext = {
  view: LeftView;
  setLeftView: (view: LeftView) => void;
  disableButtons: boolean;
  showBridgeMenu: boolean;
  onOpenTransfer: () => void;
  isTransferOpen: boolean;
};

const connectionTone = {
  connected: "bg-emerald-400 animate-pulse",
  error: "bg-red-400",
  default: "bg-neutral-500",
} as const;

const getConnectionToneClass = (status: string | undefined) => {
  if (status === "connected") {
    return connectionTone.connected;
  }
  if (status === "error") {
    return connectionTone.error;
  }
  return connectionTone.default;
};

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
      identity: {
        playerId,
        walletAddress,
        displayName,
      },
      queryParams: {
        walletAddress,
        playerName: displayName,
      },
      joinZones: zoneIds,
    };
  }, [ConnectedAccount?.address, accountName, realtimeBaseUrl, zoneIds]);

  return { initializer, defaultZoneId, zoneIds };
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "lg";

const getResponsiveButtonSize = (itemCount: number): CircleButtonProps["size"] => {
  // Panel width is 420px, padding is 24px (px-3 on each side), available ~396px
  // lg buttons: 48px + 8px gap = fits ~7 buttons
  // md buttons: 40px + 8px gap = fits ~8 buttons
  // sm buttons: 32px + 8px gap = fits ~10 buttons
  if (itemCount <= 7) return "lg";
  if (itemCount <= 8) return "md";
  return "sm";
};

const HEADER_HEIGHT = 64;
const PANEL_WIDTH = 420;
const HANDLE_WIDTH = 14;

const ORDERED_MENU_IDS: MenuEnum[] = [
  MenuEnum.entityDetails, // Realm Info
  MenuEnum.construction, // Buildings
  MenuEnum.military, // Army
  MenuEnum.resourceArrivals, // Donkey arrivals
  MenuEnum.trade, // Trade
  MenuEnum.transfer, // Transfers
  MenuEnum.bridge, // Bridge
  MenuEnum.chat, // Chat
  MenuEnum.storyEvents, // Chronicles
  MenuEnum.predictionMarket, // Prediction Market
];

const buildRealmNavigationItems = ({
  view,
  setView,
  disableButtons,
  canOpenConstruction,
  arrivedArrivalsNumber,
  pendingArrivalsNumber,
  toggleModal,
  isTradeOpen,
  showTradeMenu,
}: RealmNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: LeftView) => () => {
    setView(view === targetView ? LeftView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.entityDetails,
      className: "entity-details-selector",
      image: BuildingThumbs.house,
      tooltipLocation: "top",
      label: "Realm Info",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.EntityView || view === LeftView.None,
      onClick: toggleView(LeftView.EntityView),
    },
    {
      id: MenuEnum.construction,
      className: "construction-selector",
      image: BuildingThumbs.construction,
      tooltipLocation: "top",
      label: construction,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons || !canOpenConstruction,
      active: view === LeftView.ConstructionView,
      onClick: toggleView(LeftView.ConstructionView),
    },
    {
      id: MenuEnum.military,
      className: "military-selector",
      image: BuildingThumbs.military,
      tooltipLocation: "top",
      label: military,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.MilitaryView,
      onClick: toggleView(LeftView.MilitaryView),
    },
    {
      id: MenuEnum.resourceArrivals,
      image: BuildingThumbs.trade,
      tooltipLocation: "top",
      label: "Resource Arrivals",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.ResourceArrivals,
      onClick: toggleView(LeftView.ResourceArrivals),

      primaryNotification:
        arrivedArrivalsNumber > 0
          ? { value: arrivedArrivalsNumber, color: "green", location: "topright" as const }
          : undefined,
      secondaryNotification:
        pendingArrivalsNumber > 0
          ? { value: pendingArrivalsNumber, color: "orange", location: "bottomright" as const }
          : undefined,
    },
    {
      id: MenuEnum.trade,
      className: "trade-selector",
      image: BuildingThumbs.scale,
      tooltipLocation: "top",
      label: trade,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: isTradeOpen,
      onClick: () => toggleModal(isTradeOpen ? null : <MarketModal />),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.entityDetails,
    MenuEnum.military,
    MenuEnum.construction,
    MenuEnum.hyperstructures,
    MenuEnum.resourceArrivals,
    MenuEnum.relics,
    ...(showTradeMenu ? [MenuEnum.trade] : []),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const buildEconomyNavigationItems = ({
  view,
  setLeftView,
  disableButtons,
  showBridgeMenu,
  onOpenTransfer,
  isTransferOpen,
}: EconomyNavigationContext): NavigationItem[] => {
  const items: NavigationItem[] = [
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfers",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: isTransferOpen,
      onClick: () => {
        onOpenTransfer();
      },
    },
    ...(showBridgeMenu
      ? ([
          {
            id: MenuEnum.bridge,
            className: "bridge-selector",
            image: BuildingThumbs.bridge,
            tooltipLocation: "top",
            label: "Bridge",
            size: DEFAULT_BUTTON_SIZE,
            disabled: disableButtons,
            active: view === LeftView.BridgeView,
            onClick: () => {
              setLeftView(view === LeftView.BridgeView ? LeftView.None : LeftView.BridgeView);
            },
          },
        ] satisfies NavigationItem[])
      : []),
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: view === LeftView.StoryEvents,
      onClick: () => {
        setLeftView(view === LeftView.StoryEvents ? LeftView.None : LeftView.StoryEvents);
      },
    },
    {
      id: MenuEnum.predictionMarket,
      className: "prediction-market-selector",
      image: BuildingThumbs.predictionMarket,
      tooltipLocation: "top",
      label: "Prediction Market",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: view === LeftView.PredictionMarket,
      onClick: () => {
        setLeftView(view === LeftView.PredictionMarket ? LeftView.None : LeftView.PredictionMarket);
      },
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.transfer,
    ...(showBridgeMenu ? [MenuEnum.bridge] : []),
    MenuEnum.storyEvents,
    MenuEnum.predictionMarket,
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

type LeftPanelChatProps = {
  initializer: InitializeRealtimeClientParams | null;
  zoneIds: string[];
  defaultZoneId: string;
};

const LeftPanelChat = ({ initializer, zoneIds, defaultZoneId }: LeftPanelChatProps) => {
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

const EntityDetails = lazy(() =>
  import("@/ui/modules/entity-details/entity-details").then((module) => ({ default: module.EntityDetails })),
);
const Military = lazy(() => import("@/ui/features/military").then((module) => ({ default: module.Military })));
const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);
const Bridge = lazy(() =>
  import("@/ui/features/infrastructure/bridge/bridge").then((module) => ({
    default: module.Bridge,
  })),
);
const BlitzHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.BlitzHyperstructuresMenu,
  })),
);
const EternumHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.EternumHyperstructuresMenu,
  })),
);
const InGameMarket = lazy(() =>
  import("@/ui/features/market").then((module) => ({
    default: module.InGameMarket,
  })),
);
const HYPERSTRUCTURES_MENU_BY_VARIANT = {
  blitz: BlitzHyperstructuresMenu,
  eternum: EternumHyperstructuresMenu,
} as const;

export const LeftCommandSidebar = memo(() => {
  const {
    account: { account },
    setup,
  } = useDojo();
  const components = setup.components;

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const isTradeOpen = useUIStore((state) => state.openedPopups.includes(trade));
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const structures = useUIStore((state) => state.playerStructures);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const { structureGroups, updateStructureGroup } = useStructureGroups();
  const mode = useGameModeConfig();

  // Rename popup signal lives in the global store now so the top-zone picker
  // pills can trigger a rename without prop-drilling into this component.
  const pendingRenameStructureEntityId = useUIStore((state) => state.pendingRenameStructureEntityId);
  const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const bumpStructureNameVersion = useUIStore((state) => state.bumpStructureNameVersion);

  const handleNameChange = useCallback(
    (entityId: ID, newName: string) => {
      setEntityNameLocalStorage(entityId, newName);
      setPendingRenameStructureEntityId(null);
      bumpStructureNameVersion();
    },
    [bumpStructureNameVersion, setPendingRenameStructureEntityId],
  );

  const handleOpenTransferPopup = useCallback(() => {
    setTransferPanelSourceId(null);
    togglePopup(TRANSFER_POPUP_NAME);
  }, [setTransferPanelSourceId, togglePopup]);

  const {
    initializer: realtimeInitializer,
    defaultZoneId: chatDefaultZoneId,
    zoneIds: chatZoneIds,
  } = useRealtimeChatConfig();
  useRealtimeChatInitializer(realtimeInitializer);
  const chatActions = useRealtimeChatActions();
  const { connectionStatus } = useRealtimeConnection();
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const unreadChatTotal = unreadDirectTotal + unreadWorldTotal;
  const isChatOpen = useRealtimeChatSelector((state) => state.isShellOpen);

  const navHeight = `calc(100vh - ${HEADER_HEIGHT}px)`;

  useEffect(() => {
    if (view === LeftView.ChatView) {
      chatActions.setShellOpen(true);
    } else {
      chatActions.setShellOpen(false);
    }
  }, [chatActions, view]);

  const prevChatOpen = useRef(isChatOpen);
  useEffect(() => {
    if (prevChatOpen.current && !isChatOpen && view === LeftView.ChatView) {
      setView(LeftView.None);
    }
    prevChatOpen.current = isChatOpen;
  }, [isChatOpen, setView, view]);

  // listen to structure updates
  const structure = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));

  const structureInfo = useMemo(() => {
    // Include structureNameVersion to refresh cached info when renames happen locally.
    void structureNameVersion;
    return mode.structure.getEntityInfo(structureEntityId, ContractAddress(account.address), components);
  }, [structureEntityId, structure, account.address, components, structureNameVersion, mode]);

  const canOpenConstruction = useMemo(
    () => resolveStructureUiCapabilities({ category: structureInfo?.structureCategory }).canOpenConstruction,
    [structureInfo],
  );

  const realmNavigationItems = useMemo(
    () =>
      buildRealmNavigationItems({
        view,
        setView,
        disableButtons,
        canOpenConstruction,
        arrivedArrivalsNumber,
        pendingArrivalsNumber,
        toggleModal,
        isTradeOpen,
        showTradeMenu: mode.ui.showTradeMenu,
      }),
    [
      view,
      setView,
      disableButtons,
      canOpenConstruction,
      arrivedArrivalsNumber,
      pendingArrivalsNumber,
      toggleModal,
      isTradeOpen,
      mode,
    ],
  );

  const economyNavigationItems = useMemo(
    () =>
      buildEconomyNavigationItems({
        view,
        setLeftView: setView,
        disableButtons,
        showBridgeMenu: mode.ui.showBridgeMenu,
        onOpenTransfer: handleOpenTransferPopup,
        isTransferOpen: isTransferPopupOpen,
      }),
    [view, setView, disableButtons, handleOpenTransferPopup, isTransferPopupOpen, mode],
  );

  const chatNavigationItem = useMemo<NavigationItem>(() => {
    const isActive = view === LeftView.ChatView;
    return {
      id: MenuEnum.chat,
      className: "chat-selector",
      label: "Chat",
      size: DEFAULT_BUTTON_SIZE,
      tooltipLocation: "top",
      disabled: !realtimeInitializer,
      active: isActive,
      onClick: () => {
        setView(isActive ? LeftView.None : LeftView.ChatView);
      },
      primaryNotification:
        unreadChatTotal > 0
          ? {
              value: unreadChatTotal,
              color: "red",
              location: "topright" as const,
            }
          : undefined,
      children: (
        <div className="relative flex h-full w-full items-center justify-center">
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" style={{ color: "#996929" }} />
          <span
            className={clsx("absolute bottom-1 right-1 h-2 w-2 rounded-full", getConnectionToneClass(connectionStatus))}
          />
        </div>
      ),
    };
  }, [connectionStatus, realtimeInitializer, setView, unreadChatTotal, view]);

  const ConnectedAccount = useAccountStore((state) => state.account);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const computedWidth = isCollapsed ? HANDLE_WIDTH : PANEL_WIDTH + HANDLE_WIDTH;
  const panelHeightStyle = useMemo(() => ({ height: navHeight, maxHeight: navHeight }), [navHeight]);
  const outerPanelStyle = useMemo(() => ({ ...panelHeightStyle, marginTop: `${HEADER_HEIGHT}px` }), [panelHeightStyle]);
  const containerPanelStyle = useMemo(() => ({ ...panelHeightStyle, width: `${PANEL_WIDTH}px` }), [panelHeightStyle]);
  const showEmptyState = false;
  const contentScrollClass = view === LeftView.ChatView ? "overflow-hidden" : "overflow-y-auto";

  const combinedNavigationItems = useMemo(() => {
    const navigationItems = [...realmNavigationItems, chatNavigationItem, ...economyNavigationItems];
    return ORDERED_MENU_IDS.map((id) => navigationItems.find((item) => item.id === id)).filter(
      (item): item is NavigationItem => Boolean(item),
    );
  }, [realmNavigationItems, chatNavigationItem, economyNavigationItems]);

  const responsiveButtonSize = useMemo(
    () => getResponsiveButtonSize(combinedNavigationItems.length),
    [combinedNavigationItems.length],
  );

  const pendingRenameStructure = useComponentValue(
    components.Structure,
    pendingRenameStructureEntityId
      ? getEntityIdFromKeys([BigInt(pendingRenameStructureEntityId)])
      : undefined,
  );

  const pendingRenameMetadata = pendingRenameStructure ? mode.structure.getName(pendingRenameStructure) : null;
  const editingStructureId =
    pendingRenameStructureEntityId !== null ? Number(pendingRenameStructureEntityId) : null;

  return (
    <>
      <div className="pointer-events-none h-full" style={outerPanelStyle}>
        <div className="flex h-full pointer-events-auto" style={{ width: `${computedWidth}px` }}>
          {!isCollapsed && (
            <BaseContainer
              className="pointer-events-auto flex h-full w-full flex-col panel-wood panel-wood-corners overflow-hidden shadow-2xl"
              style={containerPanelStyle}
            >
              <div className="flex-1 overflow-hidden">
                <div className={clsx("h-full pr-1", contentScrollClass)}>
                  <Suspense fallback={<div className="p-8">Loading...</div>}>
                    {view === LeftView.StoryEvents && (
                      <div className="story-events-selector flex h-full flex-col flex-1 overflow-y-auto">
                        <StoryEventsChronicles />
                      </div>
                    )}
                    {view === LeftView.PredictionMarket && (
                      <div className="prediction-market-selector flex h-full flex-col flex-1 overflow-y-auto">
                        <InGameMarket />
                      </div>
                    )}
                    {view === LeftView.ChatView && (
                      <div className="h-full">
                        <LeftPanelChat
                          initializer={realtimeInitializer}
                          zoneIds={chatZoneIds}
                          defaultZoneId={chatDefaultZoneId}
                        />
                      </div>
                    )}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      (view === LeftView.EntityView || view === LeftView.None) && <EntityDetails />}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      view === LeftView.ConstructionView && <SelectPreviewBuildingMenu entityId={structureEntityId} />}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      view === LeftView.HyperstructuresView &&
                      (() => {
                        const HyperstructuresMenu = HYPERSTRUCTURES_MENU_BY_VARIANT[mode.ui.hyperstructuresMenuVariant];
                        return <HyperstructuresMenu />;
                      })()}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      view === LeftView.ResourceArrivals && (
                        <AllResourceArrivals hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
                      )}
                    {view !== LeftView.StoryEvents &&
                      view !== LeftView.PredictionMarket &&
                      view === LeftView.BridgeView && (
                        <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                          <Bridge structures={structures} />
                        </div>
                      )}
                    {showEmptyState && (
                      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gold/70">
                        Select a module to view details.
                      </div>
                    )}
                  </Suspense>
                </div>
              </div>
              {ConnectedAccount && combinedNavigationItems.length > 0 && (
                <div className="border-t border-gold/20 bg-black/40 px-3 py-3 overflow-x-auto">
                  <div className="flex gap-2">
                    {combinedNavigationItems.map((item) => (
                      <CircleButton key={item.id} {...item} size={responsiveButtonSize} />
                    ))}
                  </div>
                </div>
              )}
            </BaseContainer>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="relative flex h-full w-[14px] items-center justify-center bg-black/20 text-gold/60 transition pointer-events-auto hover:bg-gold/20"
            aria-label={isCollapsed ? "Open navigation panel" : "Collapse navigation panel"}
            style={{ width: `${HANDLE_WIDTH}px` }}
          >
            <span className="sr-only">Toggle navigation panel</span>
            <div className="pointer-events-none flex flex-col items-center gap-1">
              <span className="h-12 w-px bg-gold/40" />
              <span className="text-[10px] leading-none">{isCollapsed ? "⟩" : "⟨"}</span>
            </div>
          </button>
        </div>
      </div>
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
