import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-core";
import { useEffect, useState } from "react";
import { getLastConnector } from "@/utils/connectWallet";
import { useAccount, useConnect } from "@starknet-start/react";

export function useStarknetWallet() {
  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const [lastConnector, setLastConnector] = useState<WalletWithStarknetFeatures | null>(null);

  useEffect(() => {
    setLastConnector(getLastConnector(connectors));
  }, [isConnected, connectors]);

  function getPreferredConnector() {
    if (lastConnector) {
      return lastConnector;
    }
    return connectors.at(0);
  }

  async function openWalletModal() {
    const connector = getPreferredConnector();
    if (connector === undefined) {
      throw new Error("No Starknet wallet connector is available");
    }
    await connectWallet(connector);
  }

  async function connectWallet(connector: WalletWithStarknetFeatures) {
    await connectAsync({ connector });
    localStorage.setItem("starknetLastConnectedWallet", connector.name);
  }

  const openStarknetKitModal = openWalletModal;

  return {
    lastConnector,
    openWalletModal,
    openStarknetKitModal,
    connectWallet,
    connectors,
  };
}
