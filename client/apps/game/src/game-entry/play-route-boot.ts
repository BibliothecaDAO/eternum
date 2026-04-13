import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type BootstrapTask, useGameEntryBootstrapController } from "@/game-entry/bootstrap-controller";
import { getGameModeId } from "@/config/game-modes";
import { resolveEntryContextFromPlayRoute } from "@/game-entry/context";
import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { connectWithControllerRetry, pickPrimaryConnector } from "@/hooks/context/controller-connect";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
import { parsePlayRoute, type PlayScene } from "@/play/navigation/play-route";
import type { SetupResult } from "@/init/bootstrap";
import { useAccount, useConnect } from "@starknet-react/core";
import { Account } from "starknet";
import type { AccountInterface } from "starknet";
import { create } from "zustand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { resolvePlayBootRequest, type ResolvedPlayBootRequest } from "./play-route-boot-request";
import { usePlayRouteReadinessStore } from "./play-route-readiness-store";

const PLAY_ROUTE_RECONNECT_GRACE_MS = 4000;
const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

export type PlayRouteBootPhase =
  | "normalize_route"
  | "await_account"
  | "select_world"
  | "setup_dojo"
  | "initial_sync"
  | "seed_entry_state"
  | "init_renderer"
  | "wait_worldmap_ready"
  | "handoff_scene"
  | "ready"
  | "reconnect_required"
  | "error";

interface PlayRouteBootSnapshot {
  account: Account | AccountInterface | null;
  bootToken: number;
  currentTask: string | null;
  error: Error | null;
  phase: PlayRouteBootPhase;
  progress: number;
  resolvedRequest: ResolvedPlayBootRequest | null;
  setupResult: SetupResult | null;
  tasks: BootstrapTask[];
}

interface PlayRouteBootControllerState extends PlayRouteBootSnapshot {
  connectWallet: () => void;
  isReconnectRequired: boolean;
  retry: () => void;
}

const createPendingTasks = (): BootstrapTask[] => [
  { id: "world", label: "Selecting world", status: "pending" },
  { id: "manifest", label: "Loading game config", status: "pending" },
  { id: "dojo", label: "Connecting to world", status: "pending" },
  { id: "sync", label: "Syncing game state", status: "pending" },
  { id: "renderer", label: "Preparing graphics", status: "pending" },
];

const buildSceneTasks = ({
  phase,
  resumeScene,
}: {
  phase: PlayRouteBootPhase;
  resumeScene: PlayScene | null;
}): BootstrapTask[] => {
  const hasSceneHandoff = resumeScene !== null;
  if (phase === "ready") {
    return [
      { id: "worldmap", label: "World map ready", status: "complete" },
      {
        id: "handoff",
        label: hasSceneHandoff ? "Scene handoff completed" : "World interactive",
        status: "complete",
      },
    ];
  }

  if (phase === "handoff_scene") {
    return [
      { id: "worldmap", label: "World map ready", status: "complete" },
      { id: "handoff", label: "Handing off to target scene", status: "running" },
    ];
  }

  return [
    { id: "worldmap", label: "Waiting for world map", status: "running" },
    { id: "handoff", label: "Preparing target scene", status: "pending" },
  ];
};

const usePlayRouteBootStore = create<PlayRouteBootSnapshot>(() => ({
  account: null,
  bootToken: 0,
  currentTask: null,
  error: null,
  phase: "normalize_route",
  progress: 0,
  resolvedRequest: null,
  setupResult: null,
  tasks: createPendingTasks(),
}));

const resolveBootPhase = ({
  bootstrapError,
  bootstrapStatus,
  hasResolvedAccount,
  isReconnectRequired,
  isSpectator,
  readiness,
  resolvedRequest,
}: {
  bootstrapError: Error | null;
  bootstrapStatus: "idle" | "pending-world" | "loading" | "ready" | "error";
  hasResolvedAccount: boolean;
  isReconnectRequired: boolean;
  isSpectator: boolean;
  readiness: ReturnType<typeof usePlayRouteReadinessStore.getState>;
  resolvedRequest: ResolvedPlayBootRequest | null;
}): PlayRouteBootPhase => {
  if (bootstrapError || bootstrapStatus === "error") {
    return "error";
  }

  if (!resolvedRequest) {
    return "normalize_route";
  }

  if (!isSpectator && !hasResolvedAccount) {
    return isReconnectRequired ? "reconnect_required" : "await_account";
  }

  if (bootstrapStatus === "pending-world" || bootstrapStatus === "idle") {
    return "select_world";
  }

  if (bootstrapStatus === "loading") {
    return "setup_dojo";
  }

  if (!readiness.worldmapReady) {
    return "wait_worldmap_ready";
  }

  if (resolvedRequest.resumeScene === "hex" && !readiness.hexReady) {
    return "handoff_scene";
  }

  if (resolvedRequest.resumeScene === "travel" && !readiness.fastTravelReady) {
    return "handoff_scene";
  }

  return "ready";
};

const resolveBootProgress = ({
  bootstrapProgress,
  phase,
}: {
  bootstrapProgress: number;
  phase: PlayRouteBootPhase;
}) => {
  if (phase === "ready") {
    return 100;
  }

  if (phase === "wait_worldmap_ready") {
    return Math.max(bootstrapProgress, 92);
  }

  if (phase === "handoff_scene") {
    return 97;
  }

  return bootstrapProgress;
};

export const usePlayRouteBootSnapshot = () => usePlayRouteBootStore();

export const usePlayRouteBootController = (): PlayRouteBootControllerState => {
  const location = useLocation();
  const { isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const controllerAccount = useControllerAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const { username: cartridgeUsername } = useCartridgeUsername();
  const entryContext = useMemo(() => resolveEntryContextFromPlayRoute(location), [location.pathname, location.search]);
  const bootstrap = useGameEntryBootstrapController({
    context: entryContext,
    enabled: entryContext !== null,
  });
  const playRoute = useMemo(() => parsePlayRoute(location), [location.pathname, location.search]);
  const fastTravelEnabled = useMemo(
    () => (bootstrap.setupResult ? getGameModeId() !== "blitz" : true),
    [bootstrap.setupResult],
  );
  const resolvedRequest = useMemo(
    () => resolvePlayBootRequest(location, { fastTravelEnabled }),
    [fastTravelEnabled, location.pathname, location.search],
  );
  const [placeholderAccount, setPlaceholderAccount] = useState<Account | null>(null);
  const [bootToken, setBootToken] = useState(0);
  const [hasReconnectGraceElapsed, setHasReconnectGraceElapsed] = useState(false);
  const readiness = usePlayRouteReadinessStore();
  const previousRouteRef = useRef<typeof playRoute>(null);

  useEffect(() => {
    if (cartridgeUsername) {
      setAccountName(cartridgeUsername);
    }
  }, [cartridgeUsername, setAccountName]);

  useEffect(() => {
    if (!bootstrap.setupResult) {
      setPlaceholderAccount(null);
      return;
    }

    const setupResult = bootstrap.setupResult;

    setPlaceholderAccount((current) => {
      if (current) {
        return current;
      }

      return new Account({
        provider: setupResult.network.provider.provider,
        address: NULL_ACCOUNT.address,
        signer: NULL_ACCOUNT.privateKey,
      });
    });
  }, [bootstrap.setupResult]);

  useEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = playRoute;

    if (!playRoute) {
      return;
    }

    const isSceneHandoffRouteChange =
      previousRoute?.bootMode === "map-first" &&
      previousRoute.chain === playRoute.chain &&
      previousRoute.worldName === playRoute.worldName &&
      previousRoute.resumeScene === playRoute.scene;

    const shouldStartEntryBoot =
      playRoute.bootMode === "map-first" ||
      showBlankOverlay ||
      bootstrap.setupResult === null ||
      previousRoute === null;

    if (!shouldStartEntryBoot || isSceneHandoffRouteChange) {
      return;
    }

    setBootToken((currentBootToken) => {
      const nextBootToken = currentBootToken + 1;
      usePlayRouteReadinessStore.getState().reset(nextBootToken);
      return nextBootToken;
    });
    setShowBlankOverlay(true);
  }, [bootstrap.setupResult, playRoute, setShowBlankOverlay, showBlankOverlay]);

  const resolvedAccount = useMemo(() => {
    if (resolvedRequest?.entryMode === "spectator") {
      return placeholderAccount;
    }

    return controllerAccount ?? null;
  }, [controllerAccount, placeholderAccount, resolvedRequest?.entryMode]);

  const shouldTrackReconnectGrace = resolvedRequest?.entryMode === "player" && !resolvedAccount;
  useEffect(() => {
    if (!shouldTrackReconnectGrace) {
      setHasReconnectGraceElapsed(false);
      return;
    }

    setHasReconnectGraceElapsed(false);
    const timeoutId = window.setTimeout(() => {
      setHasReconnectGraceElapsed(true);
    }, PLAY_ROUTE_RECONNECT_GRACE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldTrackReconnectGrace, location.pathname, location.search]);

  const connectWallet = useCallback(() => {
    if (isConnected || isConnecting) {
      return;
    }

    const primaryConnector = pickPrimaryConnector(connectors);
    if (!primaryConnector) {
      console.error("Unable to connect wallet: no connectors available");
      return;
    }

    void connectWithControllerRetry(connectAsync, primaryConnector).catch((error) => {
      console.error("Unable to connect wallet:", error);
    });
  }, [connectAsync, connectors, isConnected, isConnecting]);

  const phase = resolveBootPhase({
    bootstrapError: bootstrap.error,
    bootstrapStatus: bootstrap.status,
    hasResolvedAccount: resolvedAccount !== null,
    isReconnectRequired: shouldTrackReconnectGrace && hasReconnectGraceElapsed,
    isSpectator: resolvedRequest?.entryMode === "spectator",
    readiness,
    resolvedRequest,
  });

  const tasks = useMemo(() => {
    if (bootstrap.status === "loading" || bootstrap.status === "ready") {
      if (phase === "wait_worldmap_ready" || phase === "handoff_scene" || phase === "ready") {
        return buildSceneTasks({
          phase,
          resumeScene: resolvedRequest?.resumeScene ?? null,
        });
      }

      return bootstrap.tasks;
    }

    if (phase === "await_account" || phase === "reconnect_required") {
      return [{ id: "account", label: "Resolving account session", status: "running" as const }];
    }

    return createPendingTasks();
  }, [bootstrap.status, bootstrap.tasks, phase, resolvedRequest?.resumeScene]);

  const snapshot = useMemo<PlayRouteBootSnapshot>(
    () => ({
      account: resolvedAccount,
      bootToken,
      currentTask: bootstrap.currentTask,
      error: bootstrap.error,
      phase,
      progress: resolveBootProgress({
        bootstrapProgress: bootstrap.progress,
        phase,
      }),
      resolvedRequest,
      setupResult: bootstrap.setupResult,
      tasks,
    }),
    [
      bootToken,
      bootstrap.currentTask,
      bootstrap.error,
      bootstrap.progress,
      bootstrap.setupResult,
      phase,
      resolvedAccount,
      resolvedRequest,
      tasks,
    ],
  );

  useEffect(() => {
    usePlayRouteBootStore.setState(snapshot);
  }, [snapshot]);

  return {
    ...snapshot,
    connectWallet,
    isReconnectRequired: shouldTrackReconnectGrace && hasReconnectGraceElapsed,
    retry: bootstrap.retry,
  };
};
