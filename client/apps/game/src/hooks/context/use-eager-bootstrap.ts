import { useCallback, useEffect, useMemo } from "react";

import { useGameEntryBootstrapController, type BootstrapStatus, type BootstrapTask } from "@/game-entry/bootstrap-controller";
import { resolveEntryContextFromPlayRoute } from "@/game-entry/context";
import type { SetupResult } from "@/init/bootstrap";
import { markBootMilestone } from "@/ui/modules/boot-loader";
import { useLocation } from "react-router-dom";


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

/**
 * Eager bootstrap hook that starts the bootstrap process as soon as possible.
 * Unlike useGameBootstrap, this hook:
 * 1. Can start before account is connected
 * 2. Provides granular task status for better UX
 * 3. Waits for world selection if not already set
 *
 * Note: World changes trigger a page reload via bootstrap.tsx for clean state reset.
 */
export const useEagerBootstrap = (): EagerBootstrapState => {
  const location = useLocation();
  const entryContext = useMemo(() => {
    return resolveEntryContextFromPlayRoute(location);
  }, [location]);
  const controller = useGameEntryBootstrapController({
    context: entryContext,
    enabled: entryContext !== null,
  });

  const currentTask = useMemo(() => {
    return controller.currentTask ?? controller.tasks.find((task) => task.status === "running")?.id ?? null;
  }, [controller.currentTask, controller.tasks]);

  useEffect(() => {
    if (controller.status === "loading") {
      markBootMilestone("boot_bootstrap_started");
    }

    if (controller.status === "ready") {
      markBootMilestone("boot_bootstrap_ready");
    }
  }, [controller.status]);

  const startBootstrap = useCallback(() => {
    controller.start();
  }, [controller.start]);

  return {
    status: entryContext ? controller.status : "pending-world",
    setupResult: controller.setupResult,
    error: controller.error,
    progress: controller.progress,
    tasks: controller.tasks,
    currentTask,
    retry: controller.retry,
    startBootstrap,
  };
};
