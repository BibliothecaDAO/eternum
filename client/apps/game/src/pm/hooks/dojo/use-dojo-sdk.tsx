import type { SDK } from "@dojoengine/sdk";
import { DojoSdkProvider, useDojoSDK } from "@dojoengine/sdk/react";
import { type PropsWithChildren, useEffect, useState } from "react";
import type { StarknetDomain } from "starknet";
import { setupWorld, type SchemaType } from "../../bindings";
import { DojoConfigProvider, useDojoConfig } from "./dojo-config";

const appDomain: StarknetDomain = {
  name: "WORLD_NAME",
  version: "1.0",
  chainId: "KATANA",
  revision: "1",
};

export const useDojoSdk = () => {
  return useDojoSDK<typeof setupWorld, SchemaType>();
};

function DojoSdkProviderInner({
  children,
  domain = appDomain,
}: PropsWithChildren<{
  domain?: StarknetDomain;
}>) {
  const { dojoConfig } = useDojoConfig();
  const [sdk, setSdk] = useState<SDK<SchemaType>>();

  useEffect(() => {
    let cancelled = false;

    const initAsync = async () => {
      try {
        const { init } = await import("@dojoengine/sdk");
        const initialized = await init<SchemaType>({
          client: {
            toriiUrl: dojoConfig.toriiUrl,
            worldAddress: dojoConfig.manifest.world.address,
          },
          domain,
        });

        if (!cancelled) {
          setSdk(initialized);
        }
      } catch (error) {
        console.error("[pm-sdk] Failed to init Dojo SDK", error);
      }
    };

    void initAsync();

    return () => {
      cancelled = true;
    };
  }, [dojoConfig, domain]);

  if (!sdk) return null;

  return (
    <DojoSdkProvider sdk={sdk} dojoConfig={dojoConfig} clientFn={setupWorld}>
      {children}
    </DojoSdkProvider>
  );
}

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
  return (
    <DojoConfigProvider toriiUrl={toriiUrl} worldAddress={worldAddress}>
      <DojoSdkProviderInner domain={domain}>{children}</DojoSdkProviderInner>
    </DojoConfigProvider>
  );
};
