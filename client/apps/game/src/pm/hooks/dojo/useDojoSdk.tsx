import { init, SchemaType, type SDK } from "@dojoengine/sdk";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import type { StarknetDomain } from "starknet";
import manifestBlitz from "../../manifests/manifest_blitz.json";

const defaultSdk = {
  getEntities: async () => ({
    getItems: () => [],
  }),
  getControllers: async () => [],
  getEventMessages: async () => ({
    getItems: () => [],
  }),
  generateTypedData: () => ({
    types: {
      "pm-UserMessage": [],
    },
  }),
  client: {
    publishMessage: async () => undefined,
  },
};

export const appDomain: StarknetDomain = {
  name: "WORLD_NAME",
  version: "1.0",
  chainId: "KATANA",
  revision: "1",
};

const DojoSdkContext = createContext({
  sdk: defaultSdk as any,
  config: {
    manifest: manifestBlitz,
  },
});

export const DojoSdkProvider = DojoSdkContext.Provider;

export const useDojoSdk = () => {
  return useContext(DojoSdkContext);
};

export const DojoSdkProviderInitialized = ({
  children,
  domain = appDomain,
  toriiUrl = "",
  worldAddress = "",
}: PropsWithChildren<{
  domain?: StarknetDomain;
  toriiUrl?: string;
  worldAddress?: string;
}>) => {
  const [sdk, setSdk] = useState<SDK<SchemaType>>();
  const [config, setConfig] = useState({
    manifest: manifestBlitz,
  });

  useEffect(() => {
    let cancelled = false;

    const initAsync = async () => {
      try {
        const initialized = await init({
          client: {
            toriiUrl,
            worldAddress,
          },
          domain,
        });

        if (!cancelled) {
          setSdk(initialized);
          setConfig({
            manifest: manifestBlitz,
          });
        }
      } catch (error) {
        console.error("[pm-sdk] Failed to init Dojo SDK", error);
        if (!cancelled) {
          setSdk(defaultSdk as any);
        }
      }
    };

    void initAsync();

    return () => {
      cancelled = true;
    };
  }, [domain, toriiUrl, worldAddress]);

  if (!sdk) return null;

  return <DojoSdkProvider value={{ sdk, config }}>{children}</DojoSdkProvider>;
};
