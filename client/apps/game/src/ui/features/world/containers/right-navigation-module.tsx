import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { getIsBlitz } from "@bibliothecadao/eternum";
import clsx from "clsx";

import CircleButton from "@/ui/design-system/molecules/circle-button";
import { TransferAutomationPanel } from "@/ui/features/economy/transfers/transfer-automation-panel";
import { Bridge } from "@/ui/features/infrastructure";
import { ProductionOverviewPanel } from "@/ui/features/settlement/production/production-overview-panel";
import { RealtimeChatShell, type InitializeRealtimeClientParams } from "@/ui/features/social";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { motion } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import type { ComponentProps, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type RightNavigationItem = {
  id: MenuEnum;
} & Pick<
  CircleButtonProps,
  "active" | "className" | "disabled" | "image" | "label" | "onClick" | "size" | "tooltipLocation"
>;

type RightNavigationContext = {
  view: RightView;
  setView: (view: RightView) => void;
  disableButtons: boolean;
  toggleModal: (content: ReactNode | null) => void;
  isBlitz: boolean;
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "lg";

const MIN_PANEL_WIDTH = 460;
const MAX_PANEL_WIDTH = 1200;
const STORY_MIN_PANEL_WIDTH = 820;
const OFFSCREEN_TRANSLATION_RATIO = 0.94;
const RESIZE_STORAGE_KEY = "right-navigation-width";
const RESIZE_HINT_STORAGE_KEY = "hide-resize-hint";

const clampWidth = (value: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value));

const buildRightNavigationItems = ({
  view,
  setView,
  disableButtons,
  toggleModal,
  isBlitz,
}: RightNavigationContext): RightNavigationItem[] => {
  const toggleView = (targetView: RightView) => () => setView(view === targetView ? RightView.None : targetView);

  const items: RightNavigationItem[] = [
    {
      id: MenuEnum.resourceTable,
      className: "resource-table-selector",
      image: BuildingThumbs.resources,
      tooltipLocation: "top",
      label: "Balance",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.ResourceTable,
      onClick: toggleView(RightView.ResourceTable),
    },
    {
      id: MenuEnum.production,
      className: "production-selector",
      image: BuildingThumbs.production,
      tooltipLocation: "top",
      label: "Production",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Production,
      onClick: toggleView(RightView.Production),
    },
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfers",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Transfer,
      onClick: toggleView(RightView.Transfer),
    },
    {
      id: MenuEnum.bridge,
      className: "bridge-selector",
      image: BuildingThumbs.bridge,
      tooltipLocation: "top",
      label: "Bridge",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Bridge,
      onClick: toggleView(RightView.Bridge),
    },
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: view === RightView.StoryEvents,
      onClick: toggleView(RightView.StoryEvents),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.resourceTable,
    MenuEnum.production,
    MenuEnum.transfer,
    MenuEnum.storyEvents,
    ...(isBlitz ? [] : [MenuEnum.bridge]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const EntityResourceTable = lazy(() =>
  import("@/ui/features/economy/resources").then((module) => ({
    default: module.EntityResourceTable,
  })),
);

export const RightNavigationModule = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const structures = useUIStore((state) => state.playerStructures);
  const isBottomHudMinimized = useUIStore((state) => state.isBottomHudMinimized);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isModalOpen = useUIStore((state) => state.showModal);

  const ConnectedAccount = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const { account } = useDojo();
  const { isMapView } = useQuery();

  const isBlitz = getIsBlitz();

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = Number(window.localStorage.getItem(RESIZE_STORAGE_KEY));
      if (!Number.isNaN(stored) && stored > 0) {
        return clampWidth(stored);
      }
    }
    return clampWidth(STORY_MIN_PANEL_WIDTH);
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(RESIZE_HINT_STORAGE_KEY) !== "true" : true,
  );
  const resizeState = useRef({ startX: 0, startWidth: panelWidth });
  const [chatPortalTarget, setChatPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setChatPortalTarget(document.body);
  }, []);

  const navigationItems = useMemo(
    () =>
      buildRightNavigationItems({
        view,
        setView,
        disableButtons,
        toggleModal,
        isBlitz,
      }),
    [view, setView, disableButtons, toggleModal, isBlitz],
  );

  const storyChroniclesActive = view === RightView.StoryEvents;
  const resourceTableActive = view === RightView.ResourceTable;
  const isOffscreen = view === RightView.None;
  const isOverlayActive = isModalOpen || showBlankOverlay;
  const isBottomHudVisible = isMapView && !showBlankOverlay;
  const navHeight = useMemo(() => {
    if (!isBottomHudVisible) {
      return "calc(100vh - 48px)";
    }

    return isBottomHudMinimized ? "calc(100vh - 180px)" : "calc(100vh - 30vh)";
  }, [isBottomHudVisible, isBottomHudMinimized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESIZE_STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      return;
    }

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const delta = resizeState.current.startX - event.clientX;
      const nextWidth = clampWidth(resizeState.current.startWidth + delta);
      setPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [isResizing]);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      resizeState.current = { startX: event.clientX, startWidth: panelWidth };
      setIsResizing(true);

      if (showResizeHint) {
        setShowResizeHint(false);
        localStorage.setItem(RESIZE_HINT_STORAGE_KEY, "true");
      }
    },
    [panelWidth, showResizeHint],
  );

  const handleDismissHint = useCallback(() => {
    setShowResizeHint(false);
    localStorage.setItem(RESIZE_HINT_STORAGE_KEY, "true");
  }, []);

  const containerStyle = useMemo(() => {
    // Move 89% of the panel width offscreen to the right (matching left nav behavior)
    const translateX = isOffscreen ? panelWidth * OFFSCREEN_TRANSLATION_RATIO : 0;
    return {
      width: `${panelWidth}px`,
      transform: `translateX(${translateX}px)`,
    } as const;
  }, [panelWidth, isOffscreen]);

  const defaultZoneId = "global";
  const zoneIds = useMemo(() => [defaultZoneId], [defaultZoneId]);
  const realtimeBaseUrl = (import.meta.env.VITE_PUBLIC_REALTIME_URL as string | undefined) ?? "";

  const realtimeInitializer = useMemo<InitializeRealtimeClientParams | null>(() => {
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
  }, [ConnectedAccount, accountName, realtimeBaseUrl, zoneIds]);

  return (
    <>
      <div
        className={clsx("pointer-events-none right-0 flex space-x-1 md:pt-16 transition-all duration-300")}
        style={{ ...containerStyle, height: navHeight, maxHeight: navHeight }}
      >
        {ConnectedAccount && (
          <>
            <motion.div
              variants={{
                hidden: { x: "100%" },
                visible: { x: "0%", transition: { duration: 0.5 } },
              }}
              initial="hidden"
              animate="visible"
              className={clsx("pointer-events-auto flex flex-col justify-start")}
              style={{ height: navHeight, maxHeight: navHeight }}
            >
              <div className="flex flex-col mb-auto">
                {navigationItems.map((item) => (
                  <div key={item.id}>
                    <CircleButton {...item} />
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="relative flex h-full flex-1 overflow-hidden min-h-0">
              <div className="relative group">
                <div
                  aria-label="Resize panel"
                  role="separator"
                  aria-orientation="vertical"
                  className={clsx(
                    "pointer-events-auto h-full w-3 cursor-ew-resize select-none transition-colors relative flex items-center justify-center",
                    isResizing ? "bg-gold/40" : "bg-transparent hover:bg-gold/30",
                    showResizeHint && !isOffscreen && "animate-[pulse_1s_ease-in-out_2]",
                  )}
                  onPointerDown={handleResizeStart}
                >
                  {showResizeHint && !isOffscreen && (
                    <GripVertical className="h-4 w-4 text-gold/70 pointer-events-none" />
                  )}
                </div>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  <div className="rounded-lg border border-gold/30 bg-brown backdrop-blur-sm px-3 py-1.5 shadow-xl">
                    <p className="text-xs text-gold font-medium">Drag to resize</p>
                  </div>
                </div>
                {showResizeHint && !isOffscreen && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-50 pointer-events-auto"
                  >
                    <div className="rounded-lg border border-gold/30 bg-brown/95 backdrop-blur-sm px-3 py-2 shadow-lg max-w-[200px]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-gold/90 leading-tight">Drag this handle to resize the panel</p>
                        <button
                          onClick={handleDismissHint}
                          className="flex-shrink-0 text-gold/60 hover:text-gold transition-colors"
                          aria-label="Dismiss hint"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              <BaseContainer
                className="w-full panel-wood pointer-events-auto overflow-y-auto panel-wood-corners overflow-x-hidden"
                style={{ height: navHeight, maxHeight: navHeight }}
              >
                <Suspense fallback={<div className="p-8">Loading...</div>}>
                  {view === RightView.ResourceTable && !!structureEntityId && (
                    <div className="entity-resource-table-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                      <EntityResourceTable entityId={structureEntityId} />
                    </div>
                  )}
                  {view === RightView.Production && (
                    <div className="production-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                      <ProductionOverviewPanel />
                    </div>
                  )}
                  {view === RightView.Bridge && (
                    <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                      <Bridge structures={structures} />
                    </div>
                  )}
                  {view === RightView.Transfer && (
                    <div className="transfer-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                      <TransferAutomationPanel />
                    </div>
                  )}
                  {storyChroniclesActive && (
                    <div className="story-events-selector flex h-full flex-col flex-1 overflow-y-auto">
                      <StoryEventsChronicles />
                    </div>
                  )}
                </Suspense>
              </BaseContainer>
            </div>
          </>
        )}
      </div>

      {chatPortalTarget &&
        createPortal(
          <div
            className={clsx(
              "flex justify-end fixed right-0 bottom-6 transition-opacity duration-200",
              isOverlayActive ? "pointer-events-none z-[10] opacity-0" : "pointer-events-auto z-[45] opacity-100",
            )}
          >
            <RealtimeChatShell
              initializer={realtimeInitializer}
              zoneIds={zoneIds}
              defaultZoneId={defaultZoneId}
              className="w-full"
            />
          </div>,
          chatPortalTarget,
        )}
    </>
  );
};
