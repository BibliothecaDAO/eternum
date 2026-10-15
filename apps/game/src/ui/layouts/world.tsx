import { ArenaHud } from "../features/world/containers/arena-hud";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { SentryUserSync } from "@/observability/sentry-user-sync";
import { Leva } from "leva";
import { env } from "../../../env";
import { ArmyMovementLatencyOverlay } from "../debug/army-movement-latency-overlay";
import { DevSyncOverlay } from "../debug/dev-sync-overlay";
import { SurfaceHost } from "../design-system/molecules/popover";
import { Tooltip } from "../design-system/molecules/tooltip";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { ActionInfo } from "../features/world/components/actions/action-info";
import { ContextMenu } from "../features/world/components/context-menu/context-menu";
import { LeftViewSurfaces } from "../features/world/containers/left-view-surfaces";
import { GameCycleEffects } from "../shared/components/game-cycle-effects";
import { BlockTimestampPoller } from "../shared/components/block-timestamp-poller";
import { ActionRunners } from "../action-runners";
import { RelicCrateOpenings } from "../features/military/chest/relic-crate-openings";
import { ExpeditionRollover } from "../features/world/components/expeditions/expedition-rollover";
import { FrontierHud } from "../features/frontier/frontier-hud";
import { useExpeditionRules } from "../features/frontier/frontier-home";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { hudFor } from "./hud-for";
import { FLIGHT_TRACE_ENABLED, traceFlightCommit } from "@/three/flight-trace";
import { Profiler } from "react";
import { MotionLayer } from "@/ui/motion/motion-layer";
import { PlayOverlayManager } from "./play-overlay-manager";

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const content = (
    <>
      {/* Background managers and effects (no UI) */}
      <BackgroundSystems />

      {/* Main world layer */}
      <div
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        id="world"
        className="world-selector fixed antialiased top-0 left-0 z-0 w-screen h-dvh overflow-hidden ornate-borders pointer-events-none"
      >
        {/* Game systems */}
        <GameSystems backgroundImage={backgroundImage} />

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
  return content;
};

/**
 * Background systems that run without rendering UI.
 * These manage state synchronization, automation, and global modals.
 */
const BackgroundSystems = () => (
  <>
    <ActionRunners />
    <RelicCrateOpenings />
    <BlockTimestampPoller />
    <GameCycleEffects />
    <AutomationSystems />
    <ExpeditionRollover />
    <SentryUserSync />
  </>
);

/** Automation exists only where the mode sells it; Frontier hides every automated surface. */
const AutomationSystems = () => {
  if (!useGameModeConfig().ui.showAutomation) return null;
  return (
    <>
      <AutomationManager />
      <TransferAutomationManager />
    </>
  );
};

/**
 * Core game systems that render interactive content.
 */
const GameSystems = ({ backgroundImage }: { backgroundImage: string }) => (
  <>
    <SurfaceHost />
    <PlayOverlayManager backgroundImage={backgroundImage} />
  </>
);

/** Each mode selects its production HUD; the lab mounts the same arena views on fixture facts. */
const HUD = () => {
  const expeditionRules = useExpeditionRules();
  const hud = hudFor(useGameModeConfig().id, expeditionRules !== null);
  return (
    <>
      {/* A Frontier game opens its own surfaces (deploy, build) from its HUD; the other modes share these. */}
      {hud === "frontier" && expeditionRules ? (
        <FrontierHud rules={expeditionRules} />
      ) : hud === "shared" ? (
        <>
          <ActionInfo />
          <ArenaHud />
          <LeftViewSurfaces />
        </>
      ) : null}
      {/* Every mode's moments fly their sprites on this one layer. */}
      <MotionLayer />
      <ContextMenu />
    </>
  );
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-sm text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1 max-lg:hidden">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
