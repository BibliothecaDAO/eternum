import { createDojoConfig, DojoConfig, getContractByName } from "@dojoengine/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { loadPredictionMarketManifest, type PredictionMarketManifest } from "../../manifest-loader";
import { getPredictionMarketChain } from "../../prediction-market-config";

type DojoConfigProviderProps = PropsWithChildren<{
  toriiUrl: string;
  worldAddress: string;
}>;

type DojoConfigProviderState = {
  dojoConfig: DojoConfig;
  getContract: (ns: string, name: string) => ReturnType<typeof getContractByName>;
};

const DojoConfigProviderContext = createContext<DojoConfigProviderState | undefined>(undefined);

export function DojoConfigProvider({ children, toriiUrl, worldAddress }: DojoConfigProviderProps) {
  const chain = getPredictionMarketChain();
  const [manifest, setManifest] = useState<PredictionMarketManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setManifest(null);

    const loadManifest = async () => {
      try {
        const loadedManifest = await loadPredictionMarketManifest(chain);
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
  }, [chain]);

  const dojoConfig = useMemo(() => {
    if (!manifest) {
      return null;
    }

    return createDojoConfig({
      toriiUrl,
      manifest: {
        ...manifest,
        world: {
          ...manifest.world,
          address: worldAddress,
        },
      },
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
