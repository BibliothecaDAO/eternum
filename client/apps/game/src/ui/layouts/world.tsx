import {
  ConnectionHealthMonitor,
  resolveConnectionHealthToriiBaseUrl,
  subscribeToToriiHeartbeat,
} from "@/dojo/connection-health-monitor";
import { cancelEntityStreamSubscription, initialSync } from "@/dojo/sync";
import { resolveEntryContextFromPlayRoute } from "@/game-entry/context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { bootstrapGameForEntryContext, resetBootstrap } from "@/init/bootstrap";
import {
  addNetworkBreadcrumb,
  reportNetworkOutageDeadEnd,
  reportNetworkOutageResolved,
  setNetworkHealthScopeTags,
} from "@/observability/network-health-reporting";
import { SentryUserSync } from "@/observability/sentry-user-sync";
import { useActiveWorldProfile } from "@/runtime/world";
import { getActiveSpatialStreamManager } from "@/three/scenes/worldmap";
import { EndgameModal, NotLoggedInMessage } from "@/ui/shared";
import { useDojo } from "@bibliothecadao/react";
import { Leva } from "leva";
import { useEffect } from "react";
import { toast } from "sonner";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { useUIStore } from "../../hooks/store/use-ui-store";
import { ArmyMovementLatencyOverlay } from "../debug/army-movement-latency-overlay";
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
import { CombatSimulation } from "../modules/simulation/combat-simulation";
import { BlockTimestampPoller } from "../shared/components/block-timestamp-poller";
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
        <ArmyMovementLatencyOverlay />
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
    <RealmTransferManager zIndex={100} />
    <PlayOverlayManager backgroundImage={backgroundImage} />
    <CombatSimulation />
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

  useEffect(() => {
    const toriiBaseUrl = resolveConnectionHealthToriiBaseUrl({
      activeWorld,
      fallbackToriiUrl: fallbackToriiBaseUrl,
      runtimeToriiUrl: dojoConfig.toriiUrl,
    });

    const walletAddress = useAccountStore.getState().account?.address ?? null;
    void setNetworkHealthScopeTags({ toriiBaseUrl, walletAddress });
    let cancelled = false;
    let heartbeatSubscription: { cancel: () => void } | null = null;

    void subscribeToToriiHeartbeat(setup.network.toriiClient).then((subscription) => {
      if (cancelled) {
        subscription?.cancel();
        return;
      }
      heartbeatSubscription = subscription;
    });

    let deadEndRecoveryFired = false;
    const runDeadEndRecovery = async () => {
      const context = resolveEntryContextFromPlayRoute(window.location);
      if (!context) {
        console.warn("[ConnectionMonitor] Dead-end fired but no play-route context to recover into");
        return;
      }

      try {
        addNetworkBreadcrumb({ event: "reconnect_start", streamType: "global" });
        // Tear down the cached setup, then re-run the entry-context bootstrap.
        // This rebuilds the EternumProvider, ToriiClient, and spatial manager
        // in one pass — covers consumers that captured the old toriiClient
        // outside of streamReconnectVersion-keyed effects.
        resetBootstrap();
        await bootstrapGameForEntryContext(context);
        addNetworkBreadcrumb({ event: "reconnect_success", streamType: "global" });
        toast.success("Game state refreshed", {
          description: "Reconnected after a prolonged outage.",
        });
      } catch (error) {
        console.warn("[ConnectionMonitor] Dead-end recovery failed", error);
        addNetworkBreadcrumb({ event: "reconnect_failure", streamType: "global" });
      }
    };

    const monitor = new ConnectionHealthMonitor({
      onReconnectSpatial: async () => {
        addNetworkBreadcrumb({ event: "reconnect_start", streamType: "spatial" });
        try {
          const manager = getActiveSpatialStreamManager();
          if (manager) {
            await manager.resubscribe();
          }
          addNetworkBreadcrumb({ event: "reconnect_success", streamType: "spatial" });
        } catch (error) {
          addNetworkBreadcrumb({ event: "reconnect_failure", streamType: "spatial" });
          throw error;
        }
      },
      onReconnectGlobal: async () => {
        addNetworkBreadcrumb({ event: "reconnect_start", streamType: "global" });
        try {
          cancelEntityStreamSubscription();
          await initialSync(setup, state, () => {}, { logging: false, reportProgress: false });
          addNetworkBreadcrumb({ event: "reconnect_success", streamType: "global" });
        } catch (error) {
          addNetworkBreadcrumb({ event: "reconnect_failure", streamType: "global" });
          throw error;
        }
      },
      healthCheckFn: async () => {
        const response = await fetch(`${toriiBaseUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5_000),
        });
        return response.ok;
      },
      onRecovery: (outageMs, attempts) => {
        toast.success("Back online", {
          description: `Reconnected after ${Math.max(1, Math.round(outageMs / 1000))}s offline.`,
        });
        reportNetworkOutageResolved({ streamType: "both", outageMs, attempts });
      },
      onDeadEnd: (outageMs, attempts) => {
        reportNetworkOutageDeadEnd({ streamType: "both", outageMs, attempts });
        if (deadEndRecoveryFired) return;
        deadEndRecoveryFired = true;
        void runDeadEndRecovery();
      },
    });

    monitor.start();
    return () => {
      cancelled = true;
      heartbeatSubscription?.cancel();
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
