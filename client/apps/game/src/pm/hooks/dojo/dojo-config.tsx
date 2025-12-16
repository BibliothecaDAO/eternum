import { createDojoConfig, DojoConfig, getContractByName } from "@dojoengine/core";
import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from "react";
import manifestBlitz from "../../manifests/manifest_blitz.json";

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
  const dojoConfig = useMemo(() => {
    return createDojoConfig({
      toriiUrl,
      manifest: {
        ...manifestBlitz,
        world: {
          ...manifestBlitz.world,
          address: worldAddress,
        },
      },
    });
  }, [toriiUrl, worldAddress]);

  const getContract = useCallback(
    (ns: string, name: string) => {
      return getContractByName(dojoConfig.manifest, ns, name);
    },
    [dojoConfig],
  );

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
