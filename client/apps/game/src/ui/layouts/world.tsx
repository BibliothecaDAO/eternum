import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
import { useQuery } from "@bibliothecadao/react";
import { Leva } from "leva";
import { lazy, Suspense } from "react";
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
const TopLeftContainer = lazy(() => import("../shared/containers/top-left-container"));
const Tooltip = lazy(() =>
  import("../design-system/molecules/tooltip").then((module) => ({ default: module.Tooltip })),
);
const TopMiddleNavigation = lazy(() =>
  import("../features/world/containers/top-navigation").then((module) => ({ default: module.TopNavigation })),
);
const LeftCommandSidebar = lazy(() =>
  import("../features/world/containers/left-command-sidebar").then((module) => ({
    default: module.LeftCommandSidebar,
  })),
);
const TopHeader = lazy(() =>
  import("../features/world/containers/top-header/top-header").then((module) => ({
    default: module.TopHeader,
  })),
);
const RealtimeChatPortal = lazy(() =>
  import("../features/world/containers/realtime-chat-portal").then((module) => ({
    default: module.RealtimeChatPortal,
  })),
);
const SelectedTilePanel = lazy(() =>
  import("../features/world/components/selected-tile-panel").then((module) => ({
    default: module.SelectedTilePanel,
  })),
);

const RealmTransferManager = lazy(() =>
  import("../features/economy/resources").then((module) => ({
    default: module.RealmTransferManager,
  })),
);

const CombatSimulation = lazy(() =>
  import("../modules/simulation/combat-simulation").then((module) => ({
    default: module.CombatSimulation,
  })),
);

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
          <CombatSimulation />
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
    <LeftMiddleContainer>
      <LeftCommandSidebar />
    </LeftMiddleContainer>

    <TopCenterContainer>
      <TopMiddleNavigation />
    </TopCenterContainer>

    <TopLeftContainer>
      <TopHeader />
    </TopLeftContainer>

    <SelectedTilePanel />

    <RealtimeChatPortal />
  </div>
);

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
