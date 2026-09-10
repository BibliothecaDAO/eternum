import { LeaderboardActivitySync } from "./leaderboard-activity-sync";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { SentryUserSync } from "@/observability/sentry-user-sync";
import { Leva } from "leva";
import { env } from "../../../env";
import { ArmyMovementLatencyOverlay } from "../debug/army-movement-latency-overlay";
import { DevSyncOverlay } from "../debug/dev-sync-overlay";
import { SurfaceHost } from "../design-system/molecules/popover";
import { Tooltip } from "../design-system/molecules/tooltip";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { ExplorationAutomationManager } from "../features/infrastructure/automation/exploration-automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { ActionInfo } from "../features/world/components/actions/action-info";
import { BottomRightPanel } from "../features/world/components/bottom-right-panel";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { CompactHud } from "../features/world/containers/compact-hud";
import { LeftCommandSidebar } from "../features/world/containers/left-command-sidebar";
import { LeftViewSurfaces } from "../features/world/containers/left-view-surfaces";
import { TopHeader } from "../features/world/containers/top-header/top-header";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { GameCycleEffects } from "../shared/components/game-cycle-effects";
import { BlockTimestampPoller } from "../shared/components/block-timestamp-poller";
import { ChainTimePoller } from "../shared/components/chain-time-poller";
import { ActionRunners } from "../action-runners";
import { RelicCrateOpenings } from "../features/military/chest/relic-crate-openings";
import { RecsStoreBridge } from "./recs-store-bridge";
import { FLIGHT_TRACE_ENABLED, traceFlightCommit } from "@/three/flight-trace";
import { Profiler } from "react";
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
        {/* Game systems */}
        <GameSystems backgroundImage={backgroundImage} />

        {/* Action feedback overlays */}
        <ActionInfo />

        {/* HUD (heads-up display) elements */}
        {FLIGHT_TRACE_ENABLED ? (
          <Profiler id="hud" onRender={(id, phase, actualDuration) => traceFlightCommit(id, phase, actualDuration)}>
            <HUD />
          </Profiler>
        ) : (
          <HUD />
        )}

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
    <LeaderboardActivitySync />
    <ActionRunners />
    <RelicCrateOpenings />
    <BlockTimestampPoller />
    <GameCycleEffects />
    <ChainTimePoller />
    <BlitzSetHyperstructureShareholdersTo100 />
    <AutomationManager />
    <TransferAutomationManager />
    <ExplorationAutomationManager />
    <SentryUserSync />
  </>
);

/**
 * Core game systems that render interactive content.
 */
const GameSystems = ({ backgroundImage }: { backgroundImage: string }) => (
  <>
    <SurfaceHost />
    <PlayOverlayManager backgroundImage={backgroundImage} />
  </>
);

/**
 * HUD (Heads-Up Display) - persistent UI elements positioned around the screen.
 * Desktop layout:
 * - Top: TopHeader (player info, map toggle, clock and attention)
 * - Left: LeftCommandSidebar (structure selector and empire cockpit)
 * - Bottom: BottomRightPanel (minimap, feed, tile inspector, chat)
 * Below `lg` the columns collapse into CompactHud: one tab bar and one sheet, laid out for the phone's orientation.
 * The Build / Logistics / Military surfaces and every other popover hang off their own trigger on both layouts.
 */
const HUD = () => {
  const lane = useCompactLane();
  return (
    <>
      <TopHeader />
      <LeftViewSurfaces />
      {lane ? (
        <CompactHud lane={lane} />
      ) : (
        <>
          <LeftCommandSidebar />
          <BottomRightPanel />
        </>
      )}
    </>
  );
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1 max-lg:hidden">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
