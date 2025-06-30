import { getLastConnector } from "@/utils/connectWallet";
import { useAccount, useConnect } from "@starknet-react/core";
import { useEffect, useState } from "react";
import type { Connector, StarknetkitConnector } from "starknetkit";
import { useStarknetkitConnectModal } from "starknetkit";

export function useStarknetWallet() {
  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const [lastConnector, setLastConnector] = useState<Connector | null>(null);

  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  useEffect(() => {
    setLastConnector(getLastConnector(connectors));
  }, [isConnected, connectors]);

  async function openStarknetKitModal() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) return;
    await connectAsync({ connector });
  }

  async function connectWallet(connector: Connector) {
    await connectAsync({ connector });
    localStorage.setItem("connectedWallet", connector.id);
  }

  return { lastConnector, openStarknetKitModal, connectWallet };
}
