import { configManager } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { useDojo } from "../";

export const usePrizePool = (lordsAddress: string | undefined) => {
  const [prizePool, setPrizePool] = useState<bigint>(0n);

  const {
    account: { account },
  } = useDojo();

  const getBalance = async (address: string) => {
    if (!lordsAddress) return;
    const balance = await account?.callContract({
      contractAddress: lordsAddress,
      entrypoint: "balance_of",
      calldata: [address],
    });

    return balance;
  };

  useEffect(() => {
    const getPrizePool = async () => {
      try {
        // Get the fee recipient address from config
        const season_pool_fee_recipient = configManager?.getResourceBridgeFeeSplitConfig()?.season_pool_fee_recipient;

        if (!season_pool_fee_recipient) {
          console.error("Failed to get season pool fee recipient from config");
          return;
        }

        // Convert address to hex string with 0x prefix
        const recipientAddress = "0x" + season_pool_fee_recipient.toString(16);

        // Get balance from contract
        const balance = await getBalance(recipientAddress);

        if (balance && balance[0]) {
          setPrizePool(BigInt(balance[0]));
        }
      } catch (err) {
        console.error("Error getting prize pool:", err);
      }
    };

    getPrizePool();

    // Refresh prize pool periodically
    const interval = setInterval(getPrizePool, 60000); // Every minute

    return () => clearInterval(interval);
  }, [lordsAddress]);

  return prizePool;
};
