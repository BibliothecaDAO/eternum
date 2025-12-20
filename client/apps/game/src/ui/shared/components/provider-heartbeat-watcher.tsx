import { PROVIDER_HEARTBEAT_EVENT, type ProviderHeartbeat } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

import { useNetworkStatusStore, type NetworkType } from "@/hooks/store/use-network-status-store";
import { env } from "../../../../env";

export const ProviderHeartbeatWatcher = () => {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  const setHeartbeat = useNetworkStatusStore((state) => state.setHeartbeat);
  const setNetworkType = useNetworkStatusStore((state) => state.setNetworkType);

  // Initialize network type from environment
  useEffect(() => {
    const chain = env.VITE_PUBLIC_CHAIN;
    if (chain && ["mainnet", "sepolia", "slot", "slottest", "local"].includes(chain)) {
      setNetworkType(chain as NetworkType);
    }
  }, [setNetworkType]);

  useEffect(() => {
    const syncState = provider.getSyncState?.();
    if (syncState?.lastHeartbeat) {
      setHeartbeat(syncState.lastHeartbeat);
    }

    const handleHeartbeat = (heartbeat: ProviderHeartbeat) => {
      setHeartbeat(heartbeat);
    };

    provider.on(PROVIDER_HEARTBEAT_EVENT, handleHeartbeat);

    return () => {
      provider.off(PROVIDER_HEARTBEAT_EVENT, handleHeartbeat);
    };
  }, [provider, setHeartbeat]);

  return null;
};
