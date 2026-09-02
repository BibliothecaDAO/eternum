import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { SentryUserSync } from "@/observability/sentry-user-sync";
import { EndgameModal } from "@/ui/shared";
import { Leva } from "leva";
import { env } from "../../../env";
import { ArmyMovementLatencyOverlay } from "../debug/army-movement-latency-overlay";
import { DevSyncOverlay } from "../debug/dev-sync-overlay";
import { Tooltip } from "../design-system/molecules/tooltip";
import { NetworkStatusBanner } from "../features/world/components/network-status-banner";
import { triggerConnectionForceReconnect } from "../features/world/components/network-status-retry";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { ExplorationAutomationManager } from "../features/infrastructure/automation/exploration-automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { ActionInfo } from "../features/world/components/actions/action-info";
import { ActionInstructions } from "../features/world/components/actions/action-instructions";
import { BottomRightPanel } from "../features/world/components/bottom-right-panel";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { LeftCommandSidebar } from "../features/world/containers/left-command-sidebar";
import { TopHeader } from "../features/world/containers/top-header/top-header";
import { BlockTimestampPoller } from "../shared/components/block-timestamp-poller";
import { ChainTimePoller } from "../shared/components/chain-time-poller";
import { ActionRunners } from "../action-runners";
import { RecsStoreBridge } from "./recs-store-bridge";
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
        <Leva hidden={!DEV_MODE_ENABLED} collapsed titleBar={{ position: { x: 0, y: 50 } }} />
        <Tooltip />
        <VersionDisplay />
        <ArmyMovementLatencyOverlay />
        {DEV_MODE_ENABLED && <DevSyncOverlay />}
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
    <RecsStoreBridge />
    <ActionRunners />
    <BlockTimestampPoller />
    <ChainTimePoller />
    <EndgameModal />
    <BlitzSetHyperstructureShareholdersTo100 />
    <AutomationManager />
    <TransferAutomationManager />
    <ExplorationAutomationManager />
    <NetworkStatusBanner onRetry={triggerConnectionForceReconnect} />
    <SentryUserSync />
  </>
);

/**
 * Core game systems that render interactive content.
 */
const GameSystems = ({ backgroundImage }: { backgroundImage: string }) => (
  <>
    <PlayOverlayManager backgroundImage={backgroundImage} />
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
 * Every other surface is a popover hanging off its own trigger.
 */
const HUD = () => (
  <>
    {/* Top zone — TopHeader positions its own pills with fixed offsets. */}
    <TopHeader />

    {/* Left edge — view switcher + floating active view panel. */}
    <LeftCommandSidebar />

    {/* Bottom-right — minimap + contextual tile inspector. */}
    <BottomRightPanel />
  </>
);

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
