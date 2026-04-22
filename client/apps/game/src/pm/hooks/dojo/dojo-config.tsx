import { createDojoConfig, DojoConfig, getContractByName } from "@dojoengine/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  loadPredictionMarketManifest,
  type PredictionMarketChain,
  type PredictionMarketManifest,
} from "../../manifest-loader";
import { getPredictionMarketChain } from "../../prediction-market-config";

type DojoConfigProviderProps = PropsWithChildren<{
  toriiUrl: string;
  worldAddress: string;
  chain?: PredictionMarketChain;
}>;

type DojoConfigProviderState = {
  dojoConfig: DojoConfig;
  getContract: (ns: string, name: string) => ReturnType<typeof getContractByName>;
};

const DojoConfigProviderContext = createContext<DojoConfigProviderState | undefined>(undefined);

export function DojoConfigProvider({ children, toriiUrl, worldAddress, chain }: DojoConfigProviderProps) {
  const resolvedChain = chain ?? getPredictionMarketChain();
  const [manifest, setManifest] = useState<PredictionMarketManifest | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      try {
        const loadedManifest = await loadPredictionMarketManifest(resolvedChain);
        if (!cancelled) {
          setManifest(loadedManifest);
        }
      } catch (error) {
        console.error("[pm-dojo] Failed to load prediction market manifest", error);
        if (!cancelled) {
          setManifest(null);
        }
      }
    };

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, [resolvedChain]);

  const dojoConfig = useMemo(() => {
    if (!manifest) {
      return null;
    }

    // Dojo 1.8.x `createDojoConfig` rebuilds `world.abi` as `manifest.abis` — if the caller
    // only supplies `world.abi` (our PM manifests do) the overwrite wipes the ABI and the
    // provider later fails `isCairo1Abi([])` with "Unable to determine Cairo version".
    // Pre-populate `abis` so the rebuild becomes a no-op.
    const worldAbi = (manifest as unknown as { world: { abi?: unknown[] } }).world.abi;
    return createDojoConfig({
      toriiUrl,
      manifest: {
        ...manifest,
        abis: worldAbi,
        world: {
          ...manifest.world,
          address: worldAddress,
        },
      } as Parameters<typeof createDojoConfig>[0]["manifest"],
    });
  }, [manifest, toriiUrl, worldAddress]);

  const getContract = useCallback(
    (ns: string, name: string) => {
      if (!dojoConfig) {
        throw new Error("Dojo config has not loaded yet");
      }
      return getContractByName(dojoConfig.manifest, ns, name);
    },
    [dojoConfig],
  );

  if (!dojoConfig) {
    return null;
  }

  return (
    <DojoConfigProviderContext.Provider value={{ dojoConfig, getContract }}>
      {children}
    </DojoConfigProviderContext.Provider>
  );
}

export const useDojoConfig = () => {
  const context = useContext(DojoConfigProviderContext);

  if (context === undefined) {
    throw new Error("useDojoConfig must be used within a DojoConfigProvider");
  }

  return context;
};
