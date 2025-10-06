import { useCallback, useEffect, useRef, useState } from "react";

import type { SetupResult } from "@/init/bootstrap";
import { bootstrapGame } from "@/init/bootstrap";
import { useSyncStore } from "../store/use-sync-store";

type BootstrapStatus = "idle" | "loading" | "ready" | "error";

export type GameBootstrapState = {
  status: BootstrapStatus;
  setupResult: SetupResult | null;
  error: Error | null;
  progress: number;
  retry: () => void;
};

export const useGameBootstrap = (): GameBootstrapState => {
  const progress = useSyncStore((state) => state.initialSyncProgress);
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const inFlightRef = useRef<Promise<SetupResult> | null>(null);

  const beginBootstrap = useCallback(() => {
    if (inFlightRef.current) {
      return;
    }

    setError(null);
    setStatus("loading");

    const promise = bootstrapGame();
    inFlightRef.current = promise;

    promise
      .then((result) => {
        setSetupResult(result);
        setStatus("ready");
      })
      .catch((incomingError: unknown) => {
        const normalisedError = incomingError instanceof Error ? incomingError : new Error("Unknown bootstrap error");
        console.error("[DOJO SETUP FAILED]", normalisedError);
        setError(normalisedError);
        setStatus("error");
      })
      .finally(() => {
        inFlightRef.current = null;
      });
  }, []);

  useEffect(() => {
    if (status === "idle") {
      beginBootstrap();
    }
  }, [beginBootstrap, status]);

  const retry = useCallback(() => {
    if (status === "loading") {
      return;
    }

    beginBootstrap();
  }, [beginBootstrap, status]);

  return {
    status,
    setupResult,
    error,
    progress,
    retry,
  };
};
