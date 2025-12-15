import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
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

// Lazy load HUD components
const ActionInfo = lazy(() =>
  import("../features/world/components/actions/action-info").then((module) => ({ default: module.ActionInfo })),
);
const ActionInstructions = lazy(() =>
  import("../features/world/components/actions/action-instructions").then((module) => ({
    default: module.ActionInstructions,
  })),
);
const Tooltip = lazy(() =>
  import("../design-system/molecules/tooltip").then((module) => ({ default: module.Tooltip })),
);
const ModalWindows = lazy(() =>
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
const BottomRightPanel = lazy(() =>
  import("../features/world/components/bottom-right-panel").then((module) => ({
    default: module.BottomRightPanel,
  })),
);

// Lazy load game systems
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
      {/* Background managers and effects (no UI) */}
      <BackgroundSystems />

      {/* Main world layer */}
      <div
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        id="world"
        className="world-selector fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
      >
        <div className="vignette" />

        <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
          {/* Game systems */}
          <GameSystems backgroundImage={backgroundImage} />

          {/* Action feedback overlays */}
          <ActionOverlays />

          {/* HUD (heads-up display) elements */}
          <HUD />

          {/* Utility overlays */}
          <Leva hidden={!env.VITE_PUBLIC_GRAPHICS_DEV} collapsed titleBar={{ position: { x: 0, y: 50 } }} />
          <Tooltip />
          <VersionDisplay />
          <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
        </Suspense>
      </div>
    </>
  );
};

/**
 * Background systems that run without rendering UI.
 * These manage state synchronization, automation, and global modals.
 */
const BackgroundSystems = () => (
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

/**
 * Core game systems that render interactive content.
 */
const GameSystems = ({ backgroundImage }: { backgroundImage: string }) => (
  <>
    <RealmTransferManager zIndex={100} />
    <PlayOverlayManager backgroundImage={backgroundImage} />
    <CombatSimulation />
    <StoryEventStream />
    <NetworkDesyncIndicator />
    <NetworkDesyncDebugControls />
  </>
);

/**
 * Action feedback overlays - contextual information about current actions.
 */
const ActionOverlays = () => (
  <>
    <ActionInstructions />
    <ActionInfo />
  </>
);

/**
 * HUD (Heads-Up Display) - persistent UI elements positioned around the screen.
 * Layout:
 * - Top-left: TopHeader (player info, map toggle, tick progress)
 * - Left: LeftCommandSidebar (structure selector, navigation, views)
 * - Bottom-right: BottomRightPanel (tile info, minimap)
 * - Floating: ModalWindows (settings, shortcuts, social - rendered when open)
 */
const HUD = () => (
  <>
    {/* Top-left: Player info and controls */}
    <div className="absolute top-0 left-0 pointer-events-auto z-20">
      <TopHeader />
    </div>

    {/* Left side: Command sidebar */}
    <div className="absolute z-20 w-auto top-0 h-screen left-0 flex pointer-events-none">
      <LeftCommandSidebar />
    </div>

    {/* Bottom-right: Tile info and minimap */}
    <BottomRightPanel />

    {/* Floating modal windows (settings, social, etc.) - needs high z-index and pointer-events */}
    <div className="absolute w-screen top-10 flex pointer-events-none z-[100]">
      <ModalWindows />
    </div>
  </>
);

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
