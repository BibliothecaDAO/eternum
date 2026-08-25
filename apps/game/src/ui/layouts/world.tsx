import {
  ConnectionHealthMonitor,
  resolveConnectionHealthToriiBaseUrl,
  subscribeToToriiHeartbeat,
} from "@/dojo/connection-health-monitor";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { createConnectionDeadEndRecoveryGate } from "@/dojo/connection-dead-end-recovery-gate";
import { createToriiHeartbeatLifecycle } from "@/dojo/torii-heartbeat-lifecycle";
import { cancelGameSyncWriter, initialSync, recoverGameSyncSession } from "@/dojo/sync";
import { probeToriiHealth } from "@/dojo/torii-health-probe";
import { fetchServerWorldAvailability } from "@/dojo/fetch-server-world-availability";
import { requestGameRebootstrap } from "@/game-entry/bootstrap-controller";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  addNetworkBreadcrumb,
  reportDisconnectClassification,
  reportNetworkOutageDeadEnd,
  reportNetworkOutageResolved,
  setNetworkHealthScopeTags,
} from "@/observability/network-health-reporting";
import { SentryUserSync } from "@/observability/sentry-user-sync";
import { useActiveWorldProfile } from "@/runtime/world";
import { getActiveWorldmapRecoveryHandle } from "@/three/scenes/worldmap-reconnect-recovery-handle";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
import { useDojo } from "@bibliothecadao/react";
import { Leva } from "leva";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { useUIStore } from "../../hooks/store/use-ui-store";
import { ArmyMovementLatencyOverlay } from "../debug/army-movement-latency-overlay";
import { DevSyncOverlay } from "../debug/dev-sync-overlay";
import { Tooltip } from "../design-system/molecules/tooltip";
import { NetworkStatusBanner } from "../features/world/components/network-status-banner";
import { triggerConnectionForceReconnect } from "../features/world/components/network-status-retry";
import { RealmTransferManager } from "../features/economy/resources";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { ExplorationAutomationManager } from "../features/infrastructure/automation/exploration-automation-manager";
import { TransferAutomationManager } from "../features/infrastructure/automation/transfer-automation-manager";
import { ActionInfo } from "../features/world/components/actions/action-info";
import { ActionInstructions } from "../features/world/components/actions/action-instructions";
import { BottomRightPanel } from "../features/world/components/bottom-right-panel";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { LeftCommandSidebar } from "../features/world/containers/left-command-sidebar";
import { TopHeader } from "../features/world/containers/top-header/top-header";
import { TopNavigation as ModalWindows } from "../features/world/containers/top-navigation";
import { BlockTimestampPoller } from "../shared/components/block-timestamp-poller";
import { ChainTimePoller } from "../shared/components/chain-time-poller";
import { StoreManagers } from "../store-managers";
import { PlayOverlayManager } from "./play-overlay-manager";

const shouldRunDeadEndRecovery = createConnectionDeadEndRecoveryGate();

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
        <DevSyncOverlay />
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
    <BlockTimestampPoller />
    <ChainTimePoller />
    <NotLoggedInMessage />
    <EndgameModal />
    <BlitzSetHyperstructureShareholdersTo100 />
    <AutomationManager />
    <TransferAutomationManager />
    <ExplorationAutomationManager />
    <ConnectionMonitor />
    <NetworkStatusBanner onRetry={triggerConnectionForceReconnect} />
    <SentryUserSync />
  </>
);

/**
 * Core game systems that render interactive content.
 */
const GameSystems = ({ backgroundImage }: { backgroundImage: string }) => (
  <>
    <RealmTransferManager />
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

const getNetworkErrorReason = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown_error";
};

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
    {/* Top zone — TopHeader positions its own pills with fixed offsets. */}
    <TopHeader />

    {/* Left edge — view switcher + floating active view panel. */}
    <LeftCommandSidebar />

    {/* Bottom-right — minimap + contextual tile inspector. */}
    <BottomRightPanel />

    {/* Floating modal windows (settings, social, etc.) - needs high z-index and pointer-events */}
    <div className="absolute w-screen top-10 flex pointer-events-none z-[100]">
      <ModalWindows />
    </div>
  </>
);

/**
 * Invisible component that monitors Torii connection health and triggers
 * automatic resubscription when streams go stale (e.g. after tab sleep or
 * network interruption).
 */
const ConnectionMonitor = () => {
  const { setup } = useDojo();
  const activeWorld = useActiveWorldProfile();
  const state = useUIStore.getState();
  const fallbackToriiBaseUrl = activeWorld?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII;

  // Reconnect handlers can fire after this effect is created, so heartbeat
  // reopen uses a ref instead of the setup value captured by this closure.
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const toriiBaseUrl = resolveConnectionHealthToriiBaseUrl({
      activeWorld,
      fallbackToriiUrl: fallbackToriiBaseUrl,
      runtimeToriiUrl: dojoConfig.toriiUrl,
    });

    const walletAddress = useAccountStore.getState().account?.address ?? null;
    void setNetworkHealthScopeTags({ toriiBaseUrl, walletAddress });

    const heartbeatLifecycle = createToriiHeartbeatLifecycle({
      subscribe: () => subscribeToToriiHeartbeat(setupRef.current.network.toriiClient, toriiBaseUrl),
    });
    void heartbeatLifecycle.start();

    const recoverWorldmapAfterConnectionFailure = () => {
      try {
        getActiveWorldmapRecoveryHandle()?.recoverAfterConnectionFailure();
      } catch (error) {
        console.warn("[ConnectionMonitor] Worldmap connection-failure recovery failed", error);
      }
    };

    const monitor = new ConnectionHealthMonitor({
      onReconnectSpatial: async () => {
        // Connection health still exposes global/spatial status for the UI,
        // but both are fed by the one game sync session recovered below.
      },
      onReconnectGlobal: async () => {
        addNetworkBreadcrumb({ event: "reconnect_start", streamType: "global" });
        try {
          if (env.VITE_PUBLIC_TORII_LIGHTWEIGHT_RECONNECT) {
            // Re-open just the global stream; config/guilds/structures already
            // live in RECS and a full initialSync would turn a blip into a reboot.
            await recoverGameSyncSession();
          } else {
            cancelGameSyncWriter();
            await initialSync(setup, state, () => {}, { logging: false, reportProgress: false });
          }
          addNetworkBreadcrumb({ event: "reconnect_success", streamType: "global" });
        } catch (error) {
          addNetworkBreadcrumb({
            event: "reconnect_failure",
            streamType: "global",
            reason: getNetworkErrorReason(error),
          });
          recoverWorldmapAfterConnectionFailure();
          throw error;
        }
      },
      onReconnectComplete: () => {
        void heartbeatLifecycle.reopen();
        try {
          getActiveWorldmapRecoveryHandle()?.refreshAfterReconnect();
        } catch (error) {
          console.warn("[ConnectionMonitor] Worldmap reconnect refresh failed", error);
        }
      },
      healthCheckFn: () => probeToriiHealth(toriiBaseUrl),
      // Faster detect + recover (env-tunable per deploy): a lightweight heartbeat
      // watchdog catches staleness in seconds, and adaptive backoff recovers a
      // transient drop in ~1s instead of waiting out a flat 60s cooldown. Quiet
      // streams are proactively refreshed to dodge proxy idle / max-age reaps.
      staleThresholdMs: env.VITE_PUBLIC_TORII_STALE_THRESHOLD_MS,
      heartbeatWatchdogIntervalMs: env.VITE_PUBLIC_TORII_HEARTBEAT_WATCHDOG_INTERVAL_MS,
      minReconnectCooldownMs: env.VITE_PUBLIC_TORII_RECONNECT_MIN_COOLDOWN_MS,
      maxReconnectCooldownMs: env.VITE_PUBLIC_TORII_RECONNECT_MAX_COOLDOWN_MS,
      quietStreamRefreshMs: env.VITE_PUBLIC_TORII_QUIET_STREAM_REFRESH_MS,
      // Phase 2: independent server-side ground truth for the active world, so a
      // disconnect can be split into LOCAL vs REMOTE rather than inferred.
      getServerAvailability: () => fetchServerWorldAvailability(env.VITE_PUBLIC_REALTIME_URL, activeWorld?.name),
      onDisconnectClassified: (classification, snapshot) => {
        addNetworkBreadcrumb({
          event: "outage_start",
          streamType: "both",
          status: `${classification.source}:${classification.reason}`,
        });
        reportDisconnectClassification(classification, snapshot);
      },
      onRecovery: (outageMs, attempts) => {
        toast.success("Back online", {
          description: `Reconnected after ${Math.max(1, Math.round(outageMs / 1000))}s offline.`,
        });
        reportNetworkOutageResolved({ streamType: "both", outageMs, attempts });
      },
      onDeadEnd: (outageMs, attempts, reason) => {
        reportNetworkOutageDeadEnd({ streamType: "both", outageMs, attempts, reason });
        if (!shouldRunDeadEndRecovery({ toriiBaseUrl, reason })) return;
        addNetworkBreadcrumb({
          event: "reconnect_start",
          streamType: "global",
          status: "route_rebootstrap",
          reason,
        });
        requestGameRebootstrap(`connection_dead_end:${reason ?? "unknown"}`);
      },
    });

    monitor.start();
    return () => {
      heartbeatLifecycle.dispose();
      monitor.dispose();
    };
  }, [activeWorld, fallbackToriiBaseUrl, setup, state]);

  return null;
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
