import { PROVIDER_HEARTBEAT_EVENT, type ProviderHeartbeat } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNetworkStatusStore } from "@/hooks/store/use-network-status-store";

export const ProviderHeartbeatWatcher = () => {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  const setHeartbeat = useNetworkStatusStore((state) => state.setHeartbeat);
  const setChainHeartbeat = useChainTimeStore((state) => state.setHeartbeat);

  useEffect(() => {
    const syncState = provider.getSyncState?.();
    if (syncState?.lastHeartbeat) {
      setHeartbeat(syncState.lastHeartbeat);
      setChainHeartbeat(syncState.lastHeartbeat);
    }

    const handleHeartbeat = (heartbeat: ProviderHeartbeat) => {
      setHeartbeat(heartbeat);
      setChainHeartbeat(heartbeat);
    };

    provider.on(PROVIDER_HEARTBEAT_EVENT, handleHeartbeat);

    return () => {
      provider.off(PROVIDER_HEARTBEAT_EVENT, handleHeartbeat);
    };
  }, [provider, setChainHeartbeat, setHeartbeat]);

  return null;
};
