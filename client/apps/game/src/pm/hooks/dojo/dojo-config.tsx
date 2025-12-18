import { createDojoConfig, DojoConfig, getContractByName } from "@dojoengine/core";
import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from "react";
import manifestMainnet from "../../manifests/manifest_mainnet.json";
import manifestSlot from "../../manifests/manifest_slot.json";
// todo: use mainnet or slot depending on the network
console.log({ manifestMainnet });

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
        ...manifestSlot,
        world: {
          ...manifestSlot.world,
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
