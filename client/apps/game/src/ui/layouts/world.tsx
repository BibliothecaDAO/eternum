import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
import { Leva } from "leva";
import { env } from "../../../env";
import { Tooltip } from "../design-system/molecules/tooltip";
import { StoryEventStream } from "../features";
import { RealmTransferManager } from "../features/economy/resources";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { ActionInfo } from "../features/world/components/actions/action-info";
import { ActionInstructions } from "../features/world/components/actions/action-instructions";
import { BottomRightPanel } from "../features/world/components/bottom-right-panel";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { LeftCommandSidebar } from "../features/world/containers/left-command-sidebar";
import { TopHeader } from "../features/world/containers/top-header/top-header";
import { TopNavigation as ModalWindows } from "../features/world/containers/top-navigation";
import { CombatSimulation } from "../modules/simulation/combat-simulation";
import { ChainTimePoller } from "../shared/components/chain-time-poller";
import { StoreManagers } from "../store-managers";
import { PlayOverlayManager } from "./play-overlay-manager";

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
    <ChainTimePoller />
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
