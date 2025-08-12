import { ChestAsset, chestAssets, getRandomAssets } from "@/components/modules/chest-content";
import { cosmeticsClaimAddress, lootChestsAddress } from "@/config";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDojo } from "./context/dojo-context";

interface OpenChestParams {
  tokenId: bigint;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useOpenChest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { account } = useAccount();

  const {
    setup: {
      systemCalls: { open_loot_chest },
    },
  } = useDojo();

  const openChest = useCallback(
    async ({ onSuccess, onError, tokenId }: OpenChestParams) => {
      if (!account) {
        const error = new Error("No account connected");
        onError?.(error);
        toast.error("Please connect your wallet first");
        return;
      }

      setIsLoading(true);

      try {
        // Check if the cosmetics claim address is available
        if (!cosmeticsClaimAddress) {
          throw new Error("Cosmetics claim contract address not available. Please ensure the contract is deployed.");
        }

        // Call the claim entrypoint with the token ID
        // const startTime = Date.now();
        // const tx = await open_loot_chest({
        //   signer: account,
        //   token_id: tokenId,
        //   loot_chest_address: lootChestsAddress,
        //   claim_address: cosmeticsClaimAddress,
        // });
        // const endTime = Date.now();
        // const transactionTime = endTime - startTime;

        // console.log("Transaction time:", transactionTime);

        // Wait for transaction confirmation
        toast.success("Transaction sent! Opening chest...");

        // wait for 5 seconds
        // await new Promise((resolve) => setTimeout(resolve, 5000));

        // The transaction complete event will be handled by the TxEmit component
        // which listens to provider events

        onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to open chest");
        setError(error);
        onError?.(error);
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [account, open_loot_chest, cosmeticsClaimAddress, lootChestsAddress],
  );

  return {
    openChest,
    isLoading,
    error,
  };
};

interface ChestContent {
  tokenId: bigint;
  content: ChestAsset[];
}

export const useChestContent = (tokenId: bigint) => {
  const [chestContent, setChestContent] = useState<ChestAsset[]>([]);

  const randomAssets = useMemo(() => getRandomAssets(chestAssets, 3), []);

  return randomAssets;
};
