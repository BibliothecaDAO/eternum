import { Loading } from "@/shared/ui/loading";
import { setup, SetupResult } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { useGameSelection, type FactoryWorld, type Chain } from "@bibliothecadao/game-selection";
import { buildWorldProfile, type WorldProfile } from "@bibliothecadao/game-selection";
import { getGameManifest } from "@contracts";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ETERNUM_CONFIG } from "../../config/config";
import { initialSync } from "../sync";
import { DojoProvider } from "./dojo-context";
import { dojoConfig } from "../../../../dojoConfig";

/**
 * Normalize a selector to lowercase hex without 0x prefix
 */
function normalizeSelector(selector: string): string {
  if (!selector) return "";
  const s = selector.toLowerCase();
  return s.startsWith("0x") ? s.slice(2) : s;
}

/**
 * Patch manifest with factory-provided contract addresses
 */
function patchManifestWithFactory(
  baseManifest: any,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): any {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  // Patch world address if present
  if (manifest?.world) {
    manifest.world.address = worldAddress;
  }

  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      if (addr) {
        return { ...c, address: addr };
      }
      return c;
    });
  }

  return manifest;
}

type DojoStatus = "idle" | "loading" | "ready" | "error";

interface DeferredDojoContextValue {
  status: DojoStatus;
  setupResult: SetupResult | null;
  error: Error | null;
  progress: number;
  initializeDojo: (world: FactoryWorld) => Promise<void>;
}

const DeferredDojoContext = createContext<DeferredDojoContextValue | null>(null);

export function useDeferredDojo() {
  const context = useContext(DeferredDojoContext);
  if (!context) {
    throw new Error("useDeferredDojo must be used within a DeferredDojoProvider");
  }
  return context;
}

interface DeferredDojoProviderProps {
  children: ReactNode;
}

export function DeferredDojoProvider({ children }: DeferredDojoProviderProps) {
  const [status, setStatus] = useState<DojoStatus>("idle");
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const { selectedWorld } = useGameSelection();

  const initializeDojo = useCallback(async (world: FactoryWorld) => {
    if (status === "loading") return;

    setStatus("loading");
    setError(null);
    setProgress(10);

    try {
      console.log("[DeferredDojo] Building world profile for:", world.name, world.chain);

      // Build the world profile (queries factory for contracts, resolves world address)
      setProgress(20);
      const profile: WorldProfile = await buildWorldProfile(world.chain, world.name);
      console.log("[DeferredDojo] World profile built:", profile);

      setProgress(40);

      // Get base manifest and patch with factory-provided addresses
      const baseManifest = getGameManifest(world.chain as Chain);
      const patchedManifest = patchManifestWithFactory(
        baseManifest as any,
        profile.worldAddress,
        profile.contractsBySelector,
      );

      // Update dojoConfig with the resolved URLs and patched manifest
      (dojoConfig as any).toriiUrl = profile.toriiBaseUrl;
      (dojoConfig as any).rpcUrl = profile.rpcUrl;
      (dojoConfig as any).manifest = patchedManifest;

      setProgress(50);
      console.log("[DeferredDojo] Starting Dojo setup with config:", {
        toriiUrl: profile.toriiBaseUrl,
        rpcUrl: profile.rpcUrl,
        worldAddress: profile.worldAddress,
      });

      const result = await setup(
        { ...dojoConfig },
        {
          vrfProviderAddress: import.meta.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS || "0x0",
          useBurner: world.chain === "local",
        },
        {
          onNoAccount: () => {
            console.log("No account");
          },
          onError: (err) => {
            console.error("System call error:", err);
          },
        },
      );

      setProgress(70);
      console.log("[DeferredDojo] Dojo setup complete, starting sync...");

      await initialSync(result, (syncProgress) => {
        setProgress(70 + syncProgress * 0.25);
      });

      setProgress(95);
      console.log("[DeferredDojo] Sync complete, configuring game...");

      const eternumConfig = ETERNUM_CONFIG();
      configManager.setDojo(result.components, eternumConfig);

      setProgress(100);
      setSetupResult(result);
      setStatus("ready");
      console.log("[DeferredDojo] Initialization complete!");
    } catch (err) {
      console.error("[DeferredDojo] Initialization failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [status]);

  // Auto-initialize when we have a selected world but no setup result
  useEffect(() => {
    if (selectedWorld && status === "idle" && !setupResult) {
      initializeDojo(selectedWorld);
    }
  }, [selectedWorld, status, setupResult, initializeDojo]);

  return (
    <DeferredDojoContext.Provider
      value={{
        status,
        setupResult,
        error,
        progress,
        initializeDojo,
      }}
    >
      {children}
    </DeferredDojoContext.Provider>
  );
}

// Wrapper component that shows loading until Dojo is ready
// When ready, wraps children with DojoProvider
interface DojoReadyGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function DojoReadyGate({ children, fallback }: DojoReadyGateProps) {
  const { status, error, progress, setupResult } = useDeferredDojo();

  if (status === "idle") {
    return fallback ?? <Loading className="min-h-screen" text="Waiting for world selection..." />;
  }

  if (status === "loading") {
    return fallback ?? <Loading className="min-h-screen" text={`Loading game... ${Math.round(progress)}%`} />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold text-destructive mb-2">Connection Error</h2>
        <p className="text-muted-foreground mb-4">{error?.message || "Failed to connect to game world"}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  // Wrap with DojoProvider when setup is ready
  if (setupResult) {
    return <DojoProvider value={setupResult}>{children}</DojoProvider>;
  }

  return <>{children}</>;
}
