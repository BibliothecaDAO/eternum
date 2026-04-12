import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { primeGameEntry } from "@/game-entry-preload";
import { refreshSessionPolicies } from "@/hooks/context/session-policy-refresh";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import {
  bootstrapGameForEntryContextWithLifecycle,
  getCachedBootstrappedEntrySession,
  type BootstrappedEntrySession,
  type SetupResult,
} from "@/init/bootstrap";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";

import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "./context";

export type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type BootstrapTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
};

export const BOOTSTRAP_TASKS: BootstrapTask[] = [
  { id: "world", label: "Selecting world", status: "pending" },
  { id: "manifest", label: "Loading game config", status: "pending" },
  { id: "dojo", label: "Connecting to world", status: "pending" },
  { id: "sync", label: "Syncing game state", status: "pending" },
  { id: "renderer", label: "Preparing graphics", status: "pending" },
];

const BOOTSTRAP_PROGRESS_WEIGHTS: Record<string, number> = {
  world: 5,
  manifest: 10,
  dojo: 25,
  sync: 50,
  renderer: 10,
};

const createBootstrapTasks = (): BootstrapTask[] => BOOTSTRAP_TASKS.map((task) => ({ ...task }));

const createCompletedBootstrapTasks = (): BootstrapTask[] =>
  BOOTSTRAP_TASKS.map((task) => ({
    ...task,
    status: "complete",
  }));

const resolveInitialState = (
  context: ResolvedEntryContext | null,
): {
  session: BootstrappedEntrySession | null;
  status: BootstrapStatus;
  tasks: BootstrapTask[];
} => {
  const cachedSession = context ? getCachedBootstrappedEntrySession(context) : null;

  if (cachedSession) {
    return {
      session: cachedSession,
      status: "ready",
      tasks: createCompletedBootstrapTasks(),
    };
  }

  return {
    session: null,
    status: context ? "idle" : "pending-world",
    tasks: createBootstrapTasks(),
  };
};

const updateTasksForError = (tasks: BootstrapTask[]): BootstrapTask[] => {
  return tasks.map((task) => (task.status === "running" ? { ...task, status: "error" } : task));
};

const updateTaskStatus = (
  tasks: BootstrapTask[],
  taskId: string,
  status: BootstrapTask["status"],
): BootstrapTask[] => {
  return tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
};

const calculateBootstrapProgress = ({
  status,
  syncProgress,
  tasks,
}: {
  status: BootstrapStatus;
  syncProgress: number;
  tasks: BootstrapTask[];
}): number => {
  if (status === "ready") return 100;
  if (status === "error" || status === "idle" || status === "pending-world") return 0;

  let completed = 0;
  tasks.forEach((task) => {
    if (task.status === "complete") {
      completed += BOOTSTRAP_PROGRESS_WEIGHTS[task.id] || 0;
    } else if (task.status === "running" && task.id === "sync") {
      completed += (BOOTSTRAP_PROGRESS_WEIGHTS[task.id] || 0) * (syncProgress / 100);
    }
  });

  return Math.min(99, Math.round(completed));
};

interface GameEntryBootstrapControllerState {
  currentTask: string | null;
  error: Error | null;
  progress: number;
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
  const syncProgress = useSyncStore((state) => state.initialSyncProgress);
  const initialState = useMemo(() => resolveInitialState(context), [context]);
  const [session, setSession] = useState<BootstrappedEntrySession | null>(initialState.session);
  const [status, setStatus] = useState<BootstrapStatus>(initialState.status);
  const [tasks, setTasks] = useState<BootstrapTask[]>(initialState.tasks);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = useRef<Promise<BootstrappedEntrySession> | null>(null);
  const activeRunIdRef = useRef(0);
  const contextKey = context ? resolveEntryContextCacheKey(context) : null;

  const currentTask = useMemo(() => tasks.find((task) => task.status === "running")?.id ?? null, [tasks]);
  const progress = useMemo(
    () =>
      calculateBootstrapProgress({
        status,
        syncProgress,
        tasks,
      }),
    [status, syncProgress, tasks],
  );

  const setTaskStatus = useCallback((taskId: string, taskStatus: BootstrapTask["status"]) => {
    setTasks((previousTasks) => updateTaskStatus(previousTasks, taskId, taskStatus));
  }, []);

  const refreshReadyState = useCallback(
    (nextContext: ResolvedEntryContext | null) => {
      const nextState = resolveInitialState(nextContext);
      setSession(nextState.session);
      setStatus(nextState.status);
      setTasks(nextState.tasks);
      setError(null);
      activeRunIdRef.current += 1;
      inFlightRef.current = null;
    },
    [],
  );

  const start = useCallback(() => {
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
    setTasks(createBootstrapTasks());
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    const promise = bootstrapGameForEntryContextWithLifecycle(context, {
      onWorldSelectionStarted: () => {
        setTaskStatus("world", "running");
      },
      onWorldSelectionCompleted: () => {
        setTaskStatus("world", "complete");
        setTaskStatus("manifest", "running");
      },
      onBootstrapStarted: () => {
        markGameEntryMilestone("asset-prefetch-scheduled");
        primeGameEntry("entry");
      },
    });

    inFlightRef.current = promise;

    promise
      .then(async (result) => {
        if (activeRunIdRef.current !== runId) {
          return;
        }

        const connector = useAccountStore.getState().connector;
        if (connector) {
          markGameEntryMilestone("session-policies-refresh-started");
          await refreshSessionPolicies(connector);
          if (activeRunIdRef.current !== runId) {
            return;
          }
          markGameEntryMilestone("session-policies-refresh-completed");
        } else {
          markGameEntryMilestone("session-policies-refresh-skipped");
        }

        setTasks(createCompletedBootstrapTasks());
        setSession(result);
        setStatus("ready");
        markGameEntryMilestone("entry-ready");
      })
      .catch((incomingError: unknown) => {
        if (activeRunIdRef.current !== runId) {
          return;
        }

        const normalizedError = incomingError instanceof Error ? incomingError : new Error("Unknown bootstrap error");
        setError(normalizedError);
        setStatus("error");
        setTasks((previousTasks) => updateTasksForError(previousTasks));
      })
      .finally(() => {
        if (activeRunIdRef.current === runId) {
          inFlightRef.current = null;
        }
      });
  }, [context, refreshReadyState, setTaskStatus]);

  useEffect(() => {
    refreshReadyState(context);
  }, [contextKey, refreshReadyState]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    start();
  }, [attempt, enabled, start]);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    if (syncProgress > 0 && syncProgress < 100) {
      setTaskStatus("manifest", "complete");
      setTaskStatus("dojo", "complete");
      setTaskStatus("sync", "running");
    } else if (syncProgress >= 100) {
      setTaskStatus("sync", "complete");
      setTaskStatus("renderer", "running");
    }
  }, [setTaskStatus, status, syncProgress]);

  const retry = useCallback(() => {
    if (status === "loading") {
      return;
    }

    setAttempt((currentAttempt) => currentAttempt + 1);
  }, [status]);

  return {
    currentTask,
    error,
    progress,
    retry,
    session,
    setupResult: session?.setupResult ?? null,
    start,
    status,
    tasks,
  };
};
