import { useCallback, useEffect, useRef, useState } from "react";

import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { getActiveWorld } from "@/runtime/world";
import { useSyncStore } from "../store/use-sync-store";

export type BootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type BootstrapTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
};

export type EagerBootstrapState = {
  status: BootstrapStatus;
  setupResult: SetupResult | null;
  error: Error | null;
  progress: number;
  tasks: BootstrapTask[];
  currentTask: string | null;
  retry: () => void;
  startBootstrap: () => void;
};

const BOOTSTRAP_TASKS: BootstrapTask[] = [
  { id: "world", label: "Selecting world", status: "pending" },
  { id: "manifest", label: "Loading game config", status: "pending" },
  { id: "dojo", label: "Connecting to world", status: "pending" },
  { id: "sync", label: "Syncing game state", status: "pending" },
  { id: "renderer", label: "Preparing graphics", status: "pending" },
];

/**
 * Eager bootstrap hook that starts the bootstrap process as soon as possible.
 * Unlike useGameBootstrap, this hook:
 * 1. Can start before account is connected
 * 2. Provides granular task status for better UX
 * 3. Waits for world selection if not already set
 * 4. Re-bootstraps when world selection changes
 */
export const useEagerBootstrap = (): EagerBootstrapState => {
  const syncProgress = useSyncStore((state) => state.initialSyncProgress);
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tasks, setTasks] = useState<BootstrapTask[]>(BOOTSTRAP_TASKS);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [bootstrappedWorldName, setBootstrappedWorldName] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<SetupResult> | null>(null);
  const hasStartedRef = useRef(false);

  const updateTask = useCallback((taskId: string, taskStatus: BootstrapTask["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: taskStatus } : t)));
    if (taskStatus === "running") {
      setCurrentTask(taskId);
    }
  }, []);

  const beginBootstrap = useCallback(() => {
    if (inFlightRef.current) {
      return;
    }

    // Check if world is selected
    const activeWorld = getActiveWorld();
    if (!activeWorld) {
      setStatus("pending-world");
      return;
    }

    setError(null);
    setStatus("loading");
    setSetupResult(null); // Clear previous result when starting new bootstrap
    setBootstrappedWorldName(activeWorld.name); // Track which world we're bootstrapping
    setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));

    // Mark world as complete since we have one
    updateTask("world", "complete");
    updateTask("manifest", "running");

    const promise = bootstrapGame();
    inFlightRef.current = promise;

    promise
      .then((result) => {
        // Mark all tasks complete
        setTasks((prev) => prev.map((t) => ({ ...t, status: "complete" })));
        setCurrentTask(null);
        setSetupResult(result);
        setStatus("ready");
      })
      .catch((incomingError: unknown) => {
        const normalisedError = incomingError instanceof Error ? incomingError : new Error("Unknown bootstrap error");
        console.error("[EAGER BOOTSTRAP FAILED]", normalisedError);
        setError(normalisedError);
        setStatus("error");
        // Mark current task as error
        setTasks((prev) =>
          prev.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)),
        );
      })
      .finally(() => {
        inFlightRef.current = null;
      });
  }, [updateTask]);

  // Start bootstrap automatically on mount if world is selected
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const activeWorld = getActiveWorld();
    if (activeWorld) {
      beginBootstrap();
    } else {
      setStatus("pending-world");
    }
  }, [beginBootstrap]);

  // Watch for world selection and start bootstrap when it happens
  useEffect(() => {
    if (status !== "pending-world") return;

    const checkWorld = () => {
      const activeWorld = getActiveWorld();
      if (activeWorld) {
        beginBootstrap();
      }
    };

    // Poll for world selection (localStorage doesn't have events)
    const interval = window.setInterval(checkWorld, 500);
    return () => window.clearInterval(interval);
  }, [status, beginBootstrap]);

  // Update task progress based on sync progress
  useEffect(() => {
    if (status !== "loading") return;

    if (syncProgress > 0 && syncProgress < 100) {
      updateTask("manifest", "complete");
      updateTask("dojo", "complete");
      updateTask("sync", "running");
    } else if (syncProgress >= 100) {
      updateTask("sync", "complete");
      updateTask("renderer", "running");
    }
  }, [syncProgress, status, updateTask]);

  // Watch for world CHANGES (different from initial selection)
  // If user selects a different world, we need to re-bootstrap
  useEffect(() => {
    // Only check for changes if we've already bootstrapped a world
    if (!bootstrappedWorldName) return;
    // Don't interrupt an in-flight bootstrap
    if (inFlightRef.current) return;

    const checkWorldChange = () => {
      const activeWorld = getActiveWorld();
      if (activeWorld && activeWorld.name !== bootstrappedWorldName) {
        console.log(`[EAGER BOOTSTRAP] World changed from "${bootstrappedWorldName}" to "${activeWorld.name}", re-bootstrapping...`);
        // Reset state for new bootstrap
        hasStartedRef.current = false;
        setStatus("idle");
        setSetupResult(null);
        setError(null);
        setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));
        // Trigger new bootstrap on next tick
        setTimeout(() => {
          hasStartedRef.current = true;
          beginBootstrap();
        }, 0);
      }
    };

    // Poll for world changes
    const interval = window.setInterval(checkWorldChange, 500);
    return () => window.clearInterval(interval);
  }, [bootstrappedWorldName, beginBootstrap]);

  const retry = useCallback(() => {
    if (status === "loading") return;
    hasStartedRef.current = false;
    inFlightRef.current = null;
    setStatus("idle");
    setError(null);
    setTasks(BOOTSTRAP_TASKS.map((t) => ({ ...t, status: "pending" })));

    // Restart
    setTimeout(() => {
      hasStartedRef.current = true;
      beginBootstrap();
    }, 0);
  }, [beginBootstrap, status]);

  const startBootstrap = useCallback(() => {
    if (status === "pending-world") {
      const activeWorld = getActiveWorld();
      if (activeWorld) {
        beginBootstrap();
      }
    }
  }, [status, beginBootstrap]);

  // Calculate overall progress
  const progress = (() => {
    if (status === "ready") return 100;
    if (status === "error" || status === "idle" || status === "pending-world") return 0;

    // Weight tasks
    const weights: Record<string, number> = {
      world: 5,
      manifest: 10,
      dojo: 25,
      sync: 50,
      renderer: 10,
    };

    let completed = 0;
    tasks.forEach((t) => {
      if (t.status === "complete") {
        completed += weights[t.id] || 0;
      } else if (t.status === "running" && t.id === "sync") {
        // For sync, use the actual progress
        completed += (weights[t.id] || 0) * (syncProgress / 100);
      }
    });

    return Math.min(99, Math.round(completed));
  })();

  return {
    status,
    setupResult,
    error,
    progress,
    tasks,
    currentTask,
    retry,
    startBootstrap,
  };
};
