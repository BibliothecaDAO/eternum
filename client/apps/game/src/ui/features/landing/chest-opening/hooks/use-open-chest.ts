import { getCosmeticsClaimAddress, getLootChestsAddress } from "@/utils/addresses";
import { useDojo } from "@bibliothecadao/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface OpenChestParams {
  tokenId: bigint;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseOpenChestReturn {
  openChest: (props: OpenChestParams) => void;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to open loot chests via blockchain transaction.
 * Uses Dojo system calls for proper transaction handling.
 */
export function useOpenChest(): UseOpenChestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    setup: {
      systemCalls: { open_loot_chest },
    },
    account: { account },
  } = useDojo();

  const openChest = useCallback(
    async ({ tokenId, onSuccess, onError }: OpenChestParams) => {
      if (!account) {
        const error = new Error("No account connected");
        onError?.(error);
        toast.error("Please connect your wallet first");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const lootChestAddress = getLootChestsAddress();
        const claimAddress = getCosmeticsClaimAddress();

        if (!lootChestAddress || !claimAddress) {
          throw new Error("Contract addresses not configured. Please ensure the contracts are deployed.");
        }

        // Call the system call to open the loot chest
        await open_loot_chest({
          signer: account,
          token_id: tokenId,
          loot_chest_address: lootChestAddress,
          claim_address: claimAddress,
        });

        toast.success("Transaction sent! Opening chest...");
        onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to open chest");
        console.error("Failed to open chest:", error);
        setError(error);
        onError?.(error);
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [account, open_loot_chest],
  );

  return {
    openChest,
    isLoading,
    error,
  };
}
