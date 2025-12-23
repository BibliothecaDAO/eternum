import App from "@/app/app";
import { DojoProvider } from "@/app/dojo/context/dojo-context";
import { buildWorldProfile, clearActiveWorld, getActiveWorld, getActiveWorldName, setActiveWorldName } from "@/shared/lib/world";
import { isToriiAvailable } from "@/shared/lib/world/factory-resolver";
import { Loading } from "@/shared/ui/loading";
import { WorldSelector } from "@/widgets/world-selector";
import type { Chain } from "@contracts";
import { useCallback, useEffect, useState } from "react";
import { env } from "../../../env";
import { bootstrapDojo, type BootstrapResult } from "./bootstrap-dojo";

type BootstrapPhase = "checking" | "select-world" | "booting" | "ready" | "error";

const getBootstrapError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to connect to the selected world.";
};

export const BootstrapApp = () => {
  const chain = env.VITE_PUBLIC_CHAIN as Chain;
  const [phase, setPhase] = useState<BootstrapPhase>("checking");
  const [setupResult, setSetupResult] = useState<BootstrapResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastWorldName, setLastWorldName] = useState<string | null>(() => getActiveWorldName());

  const runBootstrap = useCallback(async () => {
    try {
      setError(null);
      setProgress(0);
      setPhase("booting");
      const result = await bootstrapDojo(chain, setProgress);
      setSetupResult(result);
      setPhase("ready");
    } catch (caughtError) {
      setError(getBootstrapError(caughtError));
      setPhase("error");
    }
  }, [chain]);

  const handleSelectWorld = useCallback(
    async (worldName: string) => {
      try {
        setError(null);
        setPhase("booting");
        await buildWorldProfile(chain, worldName);
        setActiveWorldName(worldName);
        await runBootstrap();
      } catch (caughtError) {
        setError(getBootstrapError(caughtError));
        setPhase("error");
      }
    },
    [chain, runBootstrap],
  );

  const handleRetry = useCallback(() => {
    setPhase("checking");
    runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    let isActive = true;

    const checkAndBootstrap = async () => {
      if (chain === "local") {
        if (!isActive) return;
        await runBootstrap();
        return;
      }

      const activeWorld = getActiveWorld();
      if (activeWorld) {
        const toriiBaseUrl = activeWorld.toriiBaseUrl;
        const available = await isToriiAvailable(toriiBaseUrl);
        if (!available) {
          setLastWorldName(activeWorld.name);
          clearActiveWorld();
        }
      }

      if (!isActive) return;

      if (!getActiveWorld()) {
        setPhase("select-world");
        return;
      }

      await runBootstrap();
    };

    void checkAndBootstrap();

    return () => {
      isActive = false;
    };
  }, [chain, runBootstrap]);

  if (phase === "select-world") {
    return (
      <WorldSelector
        onSelectWorld={handleSelectWorld}
        warning={
          lastWorldName ? `The previous world (${lastWorldName}) is offline. Please choose another.` : undefined
        }
      />
    );
  }

  if (phase === "booting" || phase === "checking") {
    const loadingText = progress > 0 ? `Syncing world (${progress}%)...` : "Connecting to world...";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loading text={loadingText} />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <WorldSelector
        onSelectWorld={handleSelectWorld}
        error={error ?? "Unable to connect to the selected world."}
        onRetry={handleRetry}
      />
    );
  }

  if (!setupResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loading text="Preparing client..." />
      </div>
    );
  }

  return (
    <DojoProvider value={setupResult}>
      <App />
    </DojoProvider>
  );
};
