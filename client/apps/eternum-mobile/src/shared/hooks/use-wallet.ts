import { displayAddress } from "@/shared/lib/utils";
import { useAccount, useConnect } from "@starknet-react/core";

export const useWallet = () => {
  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, address, account } = useAccount();

  const connectWallet = async () => {
    if (isConnected || isConnecting) {
      return;
    }

    const primaryConnector = connectors[0];

    if (!primaryConnector) {
      console.error("Failed to connect wallet: no connector available");
      return;
    }

    try {
      console.log("Attempting to connect wallet...");
      connect({ connector: primaryConnector });
      console.log("Wallet connected successfully.");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  };

  return {
    connectWallet,
    isConnected,
    isConnecting,
    address,
    displayAddress: address ? displayAddress(address) : undefined,
    account,
  };
};
