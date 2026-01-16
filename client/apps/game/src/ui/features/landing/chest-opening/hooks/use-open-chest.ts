import { useAccountStore } from "@/hooks/store/use-account-store";
import { getCosmeticsClaimAddress, getLootChestsAddress } from "@/utils/addresses";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Call } from "starknet";

interface UseOpenChestReturn {
  openChest: (props: { tokenId: bigint; onSuccess?: () => void; onError?: (error: Error) => void }) => void;
  isLoading: boolean;
}

/**
 * Hook to open loot chests via blockchain transaction.
 * Uses direct Starknet calls to interact with the smart contract.
 * Does not require DojoProvider - works on landing pages.
 */
export function useOpenChest(): UseOpenChestReturn {
  const [isLoading, setIsLoading] = useState(false);
  // Use useAccountStore instead of useAccount - handles Cartridge controller properly
  const account = useAccountStore((state) => state.account);

  console.log("useOpenChest - account:", account?.address, account);

  const openChest = useCallback(
    async ({
      tokenId,
      onSuccess,
      onError,
    }: {
      tokenId: bigint;
      onSuccess?: () => void;
      onError?: (error: Error) => void;
    }) => {
      if (!account) {
        const error = new Error("Wallet not connected");
        toast.error("Please connect your wallet to open chests");
        onError?.(error);
        return;
      }

      setIsLoading(true);

      try {
        console.log("getting the info");
        const lootChestAddress = getLootChestsAddress();
        const claimAddress = getCosmeticsClaimAddress();

        console.log({ lootChestAddress, claimAddress });

        if (!lootChestAddress || !claimAddress) {
          throw new Error("Contract addresses not configured");
        }

        // Build multicall:
        // 1. Approve the claim contract to transfer the chest token
        // 2. Claim (burn chest and mint cosmetic)
        const callData: Call[] = [
          {
            contractAddress: lootChestAddress,
            entrypoint: "approve",
            calldata: [claimAddress, tokenId.toString(), "0"],
          },
          {
            contractAddress: claimAddress,
            entrypoint: "claim",
            calldata: [tokenId.toString(), "0"],
          },
        ];

        // Execute multicall
        await account.execute(callData);

        toast.success("Chest opened successfully!");
        onSuccess?.();
      } catch (error) {
        console.error("Failed to open chest:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to open chest";
        toast.error(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    },
    [account],
  );

  return {
    openChest,
    isLoading,
  };
}
