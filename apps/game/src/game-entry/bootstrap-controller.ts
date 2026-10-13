import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSyncStore } from "@/hooks/store/use-sync-store";
import { SupersededGameSyncStartError } from "@bibliothecadao/eternum/game-sync";
import {
  bootstrapGameForEntryContext,
  getCachedBootstrappedEntrySession,
  type BootstrappedEntrySession,
  type SetupResult,
} from "@/init/bootstrap";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";

import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "./context";

type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type BootstrapTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
};

const BOOTSTRAP_TASKS: BootstrapTask[] = [
  { id: "world", label: "Selecting world", status: "pending" },
  { id: "manifest", label: "Loading game config", status: "pending" },
  { id: "game", label: "Connecting to world", status: "pending" },
  { id: "sync", label: "Syncing game state", status: "pending" },
  { id: "renderer", label: "Preparing graphics", status: "pending" },
];

const createBootstrapTasks = (): BootstrapTask[] => BOOTSTRAP_TASKS.map((task) => ({ ...task }));

const createCompletedBootstrapTasks = (): BootstrapTask[] =>
  BOOTSTRAP_TASKS.map((task) => ({
    ...task,
    status: "complete",
  }));

/** How far the first snapshot has come, as the boot's stages see it: a tick inside one stage changes nothing here. */
type SyncStage = "waiting" | "syncing" | "synced";
const resolveSyncStage = (syncProgress: number): SyncStage =>
  syncProgress >= 100 ? "synced" : syncProgress > 0 ? "syncing" : "waiting";

type WorldSelection = "pending" | "running" | "complete";

const resolveInitialStatus = (context: ResolvedEntryContext | null): BootstrapStatus => {
  if (!context) return "pending-world";
  return getCachedBootstrappedEntrySession(context) ? "ready" : "idle";
};

/** The task under way is the furthest stage the boot has reported. */
const resolveReachedTaskId = ({
  syncStage,
  worldSelection,
}: {
  syncStage: SyncStage;
  worldSelection: WorldSelection;
}): string | null => {
  if (syncStage === "synced") return "renderer";
  if (syncStage === "syncing") return "sync";
  if (worldSelection === "complete") return "manifest";
  if (worldSelection === "running") return "world";
  return null;
};

/** Every task before the reached one is done, the reached one runs (or is where the boot failed), the rest wait. */
const resolveBootstrapTasks = ({
  status,
  syncStage,
  worldSelection,
}: {
  status: BootstrapStatus;
  syncStage: SyncStage;
  worldSelection: WorldSelection;
}): BootstrapTask[] => {
  if (status === "ready") return createCompletedBootstrapTasks();
  if (status !== "loading" && status !== "error") return createBootstrapTasks();
  const reached = BOOTSTRAP_TASKS.findIndex((task) => task.id === resolveReachedTaskId({ syncStage, worldSelection }));
  const reachedStatus = status === "error" ? "error" : "running";
  return BOOTSTRAP_TASKS.map((task, index) => ({
    ...task,
    status: index < reached ? "complete" : index === reached ? reachedStatus : "pending",
  }));
};

interface GameEntryBootstrapControllerState {
  currentTask: string | null;
  error: Error | null;
  retry: () => void;
  session: BootstrappedEntrySession | null;
  setupResult: SetupResult | null;
  start: () => void;
  status: BootstrapStatus;
  tasks: BootstrapTask[];
}

export const useGameEntryBootstrapController = ({
  context,
  enabled,
}: {
  context: ResolvedEntryContext | null;
  enabled: boolean;
}): GameEntryBootstrapControllerState => {
  const syncStage = useSyncStore((state) => resolveSyncStage(state.initialSyncProgress));
  const [session, setSession] = useState<BootstrappedEntrySession | null>(() =>
    context ? getCachedBootstrappedEntrySession(context) : null,
  );
  const [status, setStatus] = useState<BootstrapStatus>(() => resolveInitialStatus(context));
  const [worldSelection, setWorldSelection] = useState<WorldSelection>("pending");
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = useRef<Promise<BootstrappedEntrySession> | null>(null);
  const activeRunIdRef = useRef(0);
  const contextKey = context ? resolveEntryContextCacheKey(context) : null;

  const tasks = useMemo(
    () => resolveBootstrapTasks({ status, syncStage, worldSelection }),
    [status, syncStage, worldSelection],
  );
  const currentTask = useMemo(() => tasks.find((task) => task.status === "running")?.id ?? null, [tasks]);

  const completeBootstrapRun = useCallback((result: BootstrappedEntrySession) => {
    setSession(result);
    setStatus("ready");
    markGameEntryMilestone("entry-ready");
  }, []);

  const refreshReadyState = useCallback((nextContext: ResolvedEntryContext | null) => {
    setSession(nextContext ? getCachedBootstrappedEntrySession(nextContext) : null);
    setStatus(resolveInitialStatus(nextContext));
    setWorldSelection("pending");
    setError(null);
    activeRunIdRef.current += 1;
    inFlightRef.current = null;
  }, []);

  const runBootstrap = useCallback(() => {
    if (!context) {
      refreshReadyState(null);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    const cachedSession = getCachedBootstrappedEntrySession(context);
    if (cachedSession) {
      refreshReadyState(context);
      return;
    }

    setError(null);
    setSession(null);
    setStatus("loading");
    setWorldSelection("pending");
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    const promise = bootstrapGameForEntryContext(context, {
      onWorldSelectionStarted: () => setWorldSelection("running"),
      onWorldSelectionCompleted: () => setWorldSelection("complete"),
    });

    inFlightRef.current = promise;

    promise
      .then((result) => {
        if (activeRunIdRef.current !== runId) {
          return;
        }

        completeBootstrapRun(result);
      })
      .catch((incomingError: unknown) => {
        if (activeRunIdRef.current !== runId) {
          return;
        }

        if (incomingError instanceof SupersededGameSyncStartError) {
          return;
        }

        // Surface the failure: this rejection otherwise only lives in React
        // state and the recovery screen gives the player no diagnostic.
        console.error("[bootstrap] game entry bootstrap failed", incomingError);
        const normalizedError = incomingError instanceof Error ? incomingError : new Error("Unknown bootstrap error");
        setError(normalizedError);
        setStatus("error");
      })
      .finally(() => {
        if (activeRunIdRef.current === runId) {
          inFlightRef.current = null;
        }
      });
  }, [completeBootstrapRun, context, refreshReadyState]);

  const start = useCallback(() => {
    runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    refreshReadyState(context);
  }, [contextKey, refreshReadyState]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    start();
  }, [attempt, enabled, start]);

  const retry = useCallback(() => {
    if (status === "loading") {
      return;
    }

    setAttempt((currentAttempt) => currentAttempt + 1);
  }, [status]);

  return {
    currentTask,
    error,
    retry,
    session,
    setupResult: session?.setupResult ?? null,
    start,
    status,
    tasks,
  };
};
