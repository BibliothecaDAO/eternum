import { useAccountStore } from "@/hooks/store/use-account-store";
import { type IdentitySessionStatus, useIdentitySession } from "@/hooks/context/identity-session";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type BootstrapTask, useGameEntryBootstrapController } from "@/game-entry/bootstrap-controller";
import { getGameModeId } from "@/config/game-modes";
import { resolveEntryContextFromPlayRoute, type ResolvedEntryContext } from "@/game-entry/context";
import type { PlayScene } from "@/play/navigation/play-route";
import type { SetupResult } from "@/init/bootstrap";
import type { AccountInterface } from "starknet";
import { create } from "zustand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { resolvePlayBootRequest, type ResolvedPlayBootRequest } from "./play-route-boot-request";
import { usePlayRouteReadinessStore } from "./play-route-readiness-store";

const READ_ONLY_SPECTATOR_ACCOUNT = {
  address: "0x0",
  execute: async () => {
    throw new Error("Spectator sessions cannot submit transactions");
  },
} as unknown as AccountInterface;

type CanonicalPlayEntry = Pick<ResolvedEntryContext, "chain" | "intent" | "worldName">;

const resolveCanonicalPlayEntry = (entryContext: ResolvedEntryContext | null): CanonicalPlayEntry | null => {
  if (!entryContext) {
    return null;
  }

  return {
    chain: entryContext.chain,
    intent: entryContext.intent,
    worldName: entryContext.worldName,
  };
};

const matchesCanonicalPlayEntry = (
  previousEntry: CanonicalPlayEntry | null,
  currentEntry: CanonicalPlayEntry | null,
): boolean => {
  return (
    previousEntry?.chain === currentEntry?.chain &&
    previousEntry?.intent === currentEntry?.intent &&
    previousEntry?.worldName === currentEntry?.worldName
  );
};

const resolveBootstrapContext = ({
  entryContext,
  hasGameplayAccount,
}: {
  entryContext: ResolvedEntryContext | null;
  hasGameplayAccount: boolean;
}): ResolvedEntryContext | null => {
  if (!entryContext) {
    return null;
  }

  if (entryContext.intent === "spectate") {
    return entryContext;
  }

  return hasGameplayAccount ? entryContext : null;
};

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

type PlayRouteReconnectStatus = "idle" | "restoring" | "connecting" | "failed" | "connected";

interface PlayRouteBootSnapshot {
  account: AccountInterface | null;
  bootToken: number;
  currentTask: string | null;
  error: Error | null;
  phase: PlayRouteBootPhase;
  progress: number;
  reconnectError: string | null;
  reconnectStatus: PlayRouteReconnectStatus;
  resolvedRequest: ResolvedPlayBootRequest | null;
  setupResult: SetupResult | null;
  tasks: BootstrapTask[];
}

interface PlayRouteBootControllerState extends PlayRouteBootSnapshot {
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
  reconnectError: null,
  reconnectStatus: "idle",
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

// The identity session is the fact: anonymous means no gameplay account is coming, signed-in means one is being
// restored, and a provisioning error is the failure — no grace timer guesses in between.
const resolveReconnectStatus = ({
  hasResolvedAccount,
  identityStatus,
  provisioningError,
}: {
  hasResolvedAccount: boolean;
  identityStatus: IdentitySessionStatus;
  provisioningError: string | null;
}): PlayRouteReconnectStatus => {
  if (hasResolvedAccount) return "connected";
  if (provisioningError) return "failed";
  if (identityStatus === "loading") return "connecting";
  if (identityStatus === "signed-in") return "restoring";
  return "idle";
};

const resolveAccountTask = (reconnectStatus: PlayRouteReconnectStatus): BootstrapTask => {
  if (reconnectStatus === "failed") {
    return { id: "account", label: "Gameplay account recovery failed", status: "error" };
  }

  if (reconnectStatus === "connecting") {
    return { id: "account", label: "Connecting identity session", status: "running" };
  }

  if (reconnectStatus === "restoring") {
    return { id: "account", label: "Restoring gameplay account", status: "running" };
  }

  return { id: "account", label: "Resolving account session", status: "running" };
};

export const usePlayRouteBootSnapshot = () => usePlayRouteBootStore();

export const usePlayRouteBootController = (): PlayRouteBootControllerState => {
  const location = useLocation();
  const gameplayAccount = useAccountStore((state) => state.account);
  const { status: identityStatus } = useIdentitySession();
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const entryContext = useMemo(() => resolveEntryContextFromPlayRoute(location), [location.pathname, location.search]);
  const canonicalEntry = useMemo(() => resolveCanonicalPlayEntry(entryContext), [entryContext]);
  const hasGameplayAccount = gameplayAccount !== null;
  const bootstrapContext = useMemo(
    () => resolveBootstrapContext({ entryContext, hasGameplayAccount }),
    [entryContext, hasGameplayAccount],
  );
  const bootstrap = useGameEntryBootstrapController({
    context: bootstrapContext,
    enabled: bootstrapContext !== null,
  });
  const fastTravelEnabled = useMemo(
    () => (bootstrap.setupResult ? getGameModeId() !== "blitz" : true),
    [bootstrap.setupResult],
  );
  const resolvedRequest = useMemo(
    () => resolvePlayBootRequest(location, { fastTravelEnabled }),
    [fastTravelEnabled, location.pathname, location.search],
  );
  const [bootToken, setBootToken] = useState(0);
  const readiness = usePlayRouteReadinessStore();
  const nextBootTokenRef = useRef(0);
  const previousEntryRef = useRef<CanonicalPlayEntry | null>(null);

  const startPlayRouteBoot = useCallback(() => {
    const nextBootToken = nextBootTokenRef.current + 1;
    nextBootTokenRef.current = nextBootToken;
    usePlayRouteReadinessStore.getState().reset(nextBootToken);
    setBootToken(nextBootToken);
    setShowBlankOverlay(true);
  }, [setShowBlankOverlay]);

  useEffect(() => {
    if (matchesCanonicalPlayEntry(previousEntryRef.current, canonicalEntry)) {
      return;
    }

    previousEntryRef.current = canonicalEntry;
    if (!canonicalEntry) {
      return;
    }

    startPlayRouteBoot();
  }, [canonicalEntry, startPlayRouteBoot]);

  const resolvedAccount = useMemo(() => {
    if (resolvedRequest?.entryMode === "spectator") {
      return READ_ONLY_SPECTATOR_ACCOUNT;
    }

    return gameplayAccount ?? null;
  }, [gameplayAccount, resolvedRequest?.entryMode]);

  const reconnectError = useAccountStore((state) => state.provisioningError);
  const reconnectStatus = resolveReconnectStatus({
    hasResolvedAccount: resolvedAccount !== null,
    identityStatus,
    provisioningError: reconnectError,
  });

  // A player route with no account and nothing restoring it needs the sign-in surface now.
  const isReconnectRequired =
    resolvedRequest?.entryMode === "player" &&
    !resolvedAccount &&
    (reconnectStatus === "idle" || reconnectStatus === "failed");
  const phase = resolveBootPhase({
    bootstrapError: bootstrap.error,
    bootstrapStatus: bootstrap.status,
    hasResolvedAccount: resolvedAccount !== null,
    isReconnectRequired,
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
      return [resolveAccountTask(reconnectStatus)];
    }

    return createPendingTasks();
  }, [bootstrap.status, bootstrap.tasks, phase, reconnectStatus, resolvedRequest?.resumeScene]);

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
      reconnectError,
      reconnectStatus,
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
      reconnectError,
      reconnectStatus,
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
    isReconnectRequired,
    retry: bootstrap.retry,
  };
};
