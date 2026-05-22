import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { MarketModal } from "@/ui/features/economy/trading";
import { LogisticsView } from "@/ui/features/world/containers/logistics-view";
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
import { setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, type ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import type { ComponentProps, ReactNode } from "react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef } from "react";

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

const ORDERED_MENU_IDS: MenuEnum[] = [
  MenuEnum.entityDetails, // Realm Info
  MenuEnum.construction, // Buildings
  MenuEnum.military, // Army
  MenuEnum.resourceArrivals, // Logistics (Arrivals + Transfer + Automation + Balances)
  MenuEnum.trade, // Trade
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
      // Renamed: this pill now opens the unified Logistics panel
      // (Arrivals / Transfer / Automation / Balances). The old Transfer
      // modal entry was removed.
      label: "Logistics",
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
}: EconomyNavigationContext): NavigationItem[] => {
  // Transfers were folded into the Logistics pill (resourceArrivals view).
  const items: NavigationItem[] = [
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
      }),
    [view, setView, disableButtons, mode],
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

  const contentScrollClass = view === LeftView.ChatView ? "overflow-hidden" : "overflow-y-auto";

  const combinedNavigationItems = useMemo(() => {
    const navigationItems = [...realmNavigationItems, chatNavigationItem, ...economyNavigationItems];
    return ORDERED_MENU_IDS.map((id) => navigationItems.find((item) => item.id === id)).filter(
      (item): item is NavigationItem => Boolean(item),
    );
  }, [realmNavigationItems, chatNavigationItem, economyNavigationItems]);

  const pendingRenameStructure = useComponentValue(
    components.Structure,
    pendingRenameStructureEntityId
      ? getEntityIdFromKeys([BigInt(pendingRenameStructureEntityId)])
      : undefined,
  );

  const pendingRenameMetadata = pendingRenameStructure ? mode.structure.getName(pendingRenameStructure) : null;
  const editingStructureId =
    pendingRenameStructureEntityId !== null ? Number(pendingRenameStructureEntityId) : null;

  const closeView = useCallback(() => setView(LeftView.None), [setView]);

  // Keyboard handling:
  //   - Escape closes the floating view panel.
  //   - Digits 1..N toggle the corresponding visible view-switcher pill.
  // Ignore the digits while the user is typing in an input/textarea.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if (event.key === "Escape") {
        if (view !== LeftView.None) {
          closeView();
        }
        return;
      }

      // Skip when any modifier is pressed so we don't shadow browser/system bindings.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      const digit = Number(event.key);
      if (!Number.isFinite(digit) || digit < 1 || digit > 9) return;

      const item = combinedNavigationItems[digit - 1];
      if (!item || item.disabled) return;

      event.preventDefault();
      item.onClick?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeView, combinedNavigationItems, view]);

  const isPanelOpen = view !== LeftView.None;

  return (
    <>
      {/* View-switcher strip — vertical column of pills floating against the map. No container chrome. */}
      {ConnectedAccount && combinedNavigationItems.length > 0 && (
        <div className="fixed left-3 top-16 z-20 pointer-events-auto flex flex-col gap-2">
          {combinedNavigationItems.map((item) => (
            <CircleButton key={item.id} {...item} size="lg" />
          ))}
        </div>
      )}

      {/* Floating view panel — opens to the right of the strip when a view is active. */}
      {isPanelOpen && (
        <div
          className="fixed left-20 top-16 z-30 pointer-events-auto flex w-[380px] max-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-lg border border-gold/30 bg-black/85 shadow-2xl backdrop-blur-sm"
        >
          <div className={clsx("flex-1 min-h-0 pr-1", contentScrollClass)}>
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
              {view === LeftView.EntityView && <EntityDetails />}
              {view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
              {view === LeftView.ConstructionView && <SelectPreviewBuildingMenu entityId={structureEntityId} />}
              {view === LeftView.HyperstructuresView &&
                (() => {
                  const HyperstructuresMenu = HYPERSTRUCTURES_MENU_BY_VARIANT[mode.ui.hyperstructuresMenuVariant];
                  return <HyperstructuresMenu />;
                })()}
              {view === LeftView.ResourceArrivals && (
                <LogisticsView hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
              )}
              {view === LeftView.BridgeView && (
                <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                  <Bridge structures={structures} />
                </div>
              )}
            </Suspense>
          </div>
        </div>
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
