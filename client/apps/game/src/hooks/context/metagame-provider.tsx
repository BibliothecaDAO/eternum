import { useProvider } from "@starknet-react/core";
import { initMetagame, MetagameClient, MetagameProvider as MetagameProviderSDK } from "metagame-sdk";
import { ReactNode, useEffect, useState } from "react";
import { dojoConfig } from "../../../dojoConfig";

export const MetagameProvider = ({ children }: { children: ReactNode }) => {
  const [metagameClient, setMetagameClient] = useState<MetagameClient<any> | null>(null);
  const { provider } = useProvider();

  useEffect(() => {
    async function initialize() {
      const metagameClient = initMetagame<any>({
        toriiUrl: dojoConfig.toriiUrl,
        provider: provider,
      });

      setMetagameClient(metagameClient);
    }

    initialize();
  }, []);

  if (!metagameClient) {
    return <div>Loading...</div>;
  }

  return <MetagameProviderSDK metagameClient={metagameClient!}>{children}</MetagameProviderSDK>;
};
