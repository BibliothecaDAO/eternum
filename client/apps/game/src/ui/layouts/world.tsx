import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
import { useQuery } from "@bibliothecadao/react";
import { Leva } from "leva";
import { lazy, Suspense, useEffect, useRef } from "react";
import { env } from "../../../env";
import { StoryEventStream } from "../features";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { NetworkDesyncDebugControls } from "../shared/components/network-desync-debug-controls";
import { NetworkDesyncIndicator } from "../shared/components/network-desync-indicator";
import { ProviderHeartbeatWatcher } from "../shared/components/provider-heartbeat-watcher";
import { StoreManagers } from "../store-managers";
import { PlayOverlayManager } from "./play-overlay-manager";

// Lazy load components
const ActionInfo = lazy(() =>
  import("../features/world/components/actions/action-info").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../features/world/components/actions/action-instructions").then((module) => ({
    default: module.ActionInstructions,
  })),
);

const WorldContextMenu = lazy(() =>
  import("../features/world/components/context-menu").then((module) => ({ default: module.WorldContextMenu })),
);

const TopCenterContainer = lazy(() => import("../shared/containers/top-center-container"));
const LeftMiddleContainer = lazy(() => import("../shared/containers/left-middle-container"));
const RightMiddleContainer = lazy(() => import("../shared/containers/right-middle-container"));
const TopLeftContainer = lazy(() => import("../shared/containers/top-left-container"));
const Tooltip = lazy(() =>
  import("../design-system/molecules/tooltip").then((module) => ({ default: module.Tooltip })),
);
const TopMiddleNavigation = lazy(() =>
  import("../features/world/containers/top-navigation").then((module) => ({ default: module.TopNavigation })),
);
const LeftNavigationModule = lazy(() =>
  import("../features/world/containers/left-navigation-module").then((module) => ({
    default: module.LeftNavigationModule,
  })),
);
const RightNavigationModule = lazy(() =>
  import("../features/world/containers/right-navigation-module").then((module) => ({
    default: module.RightNavigationModule,
  })),
);
const TopLeftNavigation = lazy(() =>
  import("../features/world/containers/top-left-navigation/top-left-navigation").then((module) => ({
    default: module.TopLeftNavigation,
  })),
);
const BottomHud = lazy(() =>
  import("../features/world/components/hud-bottom/bottom-hud").then((module) => ({
    default: module.BottomHud,
  })),
);

const RealmTransferManager = lazy(() =>
  import("../features/economy/resources").then((module) => ({
    default: module.RealmTransferManager,
  })),
);

const BottomHudViewSync = () => {
  const { isMapView } = useQuery();
  const isBottomHudMinimized = useUIStore((state) => state.isBottomHudMinimized);
  const setIsBottomHudMinimized = useUIStore((state) => state.setIsBottomHudMinimized);

  const autoMinimizedForLocalRef = useRef(false);
  const prevIsMapViewRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevIsMapViewRef.current === null) {
      prevIsMapViewRef.current = isMapView;
      return;
    }

    const prevIsMapView = prevIsMapViewRef.current;
    prevIsMapViewRef.current = isMapView;

    // World (map) -> Local (hex)
    if (prevIsMapView && !isMapView) {
      if (!isBottomHudMinimized) {
        setIsBottomHudMinimized(true);
        autoMinimizedForLocalRef.current = true;
      } else {
        autoMinimizedForLocalRef.current = false;
      }
    }

    // Local (hex) -> World (map)
    if (!prevIsMapView && isMapView) {
      if (autoMinimizedForLocalRef.current) {
        setIsBottomHudMinimized(false);
      }
      autoMinimizedForLocalRef.current = false;
    }
  }, [isMapView, isBottomHudMinimized, setIsBottomHudMinimized]);

  return null;
};

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  return (
    <>
      <WorldEffects />

      {/* Main world layer */}
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        id="world"
        className="world-selector fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
      >
        <div className="vignette" />

        <Suspense fallback={<WorldSuspenseFallback backgroundImage={backgroundImage} />}>
          <RealmTransferManager zIndex={100} />
          <PlayOverlayManager backgroundImage={backgroundImage} />
          <WorldInteractiveLayers />

          <StoryEventStream />
          <NetworkDesyncIndicator />
          <NetworkDesyncDebugControls />

          <Leva hidden={!env.VITE_PUBLIC_GRAPHICS_DEV} collapsed titleBar={{ position: { x: 0, y: 50 } }} />
          <Tooltip />
          <VersionDisplay />
          <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
        </Suspense>
      </div>
    </>
  );
};

const WorldEffects = () => (
  <>
    <StoreManagers />
    <StructureSynchronizer />
    <ProviderHeartbeatWatcher />
    <NotLoggedInMessage />
    <EndgameModal />
    <BlitzSetHyperstructureShareholdersTo100 />
    <AutomationManager />
    <TransferAutomationManager />
  </>
);

const StructureSynchronizer = () => {
  useSyncPlayerStructures();
  return null;
};

const WorldSuspenseFallback = ({ backgroundImage }: { backgroundImage: string }) => (
  <LoadingScreen backgroundImage={backgroundImage} />
);

const WorldInteractiveLayers = () => (
  <>
    <ActionInstructions />
    <ActionInfo />
    <WorldContextMenu />
    <WorldHud />
  </>
);

const WorldHud = () => (
  <div>
    <BottomHudViewSync />
    <LeftMiddleContainer>
      <LeftNavigationModule />
    </LeftMiddleContainer>

    <TopCenterContainer>
      <TopMiddleNavigation />
    </TopCenterContainer>

    <RightMiddleContainer>
      <RightNavigationModule />
    </RightMiddleContainer>

    <TopLeftContainer>
      <TopLeftNavigation />
    </TopLeftContainer>

    <BottomHud />
  </div>
);

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
