import { displayAddress } from "@/shared/lib/utils";
import { useAccount, useConnect } from "@starknet-react/core";

export const useWallet = () => {
  const { connect, connectors } = useConnect();
  const { isConnected, isConnecting, address, account } = useAccount();

  const connectWallet = async () => {
    try {
      console.log("Attempting to connect wallet...");
      await connect({ connector: connectors[0].controller });
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
