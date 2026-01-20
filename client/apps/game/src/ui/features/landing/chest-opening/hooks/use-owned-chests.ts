import { getLootChestsAddress } from "@/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { fetchLootChestBalances } from "../services";
import { MergedNftData } from "../utils/types";
import { MOCK_CHEST_OPENING, MOCK_CHESTS } from "./mock-data";

interface UseOwnedChestsReturn {
  ownedChests: MergedNftData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch owned loot chests for the connected wallet.
 * Uses the Torii SQL API to query token balances.
 */
export function useOwnedChests(): UseOwnedChestsReturn {
  const { address } = useAccount();

  const {
    data: ownedChests = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ownedChests", address],
    queryFn: async (): Promise<MergedNftData[]> => {
      // Mock mode for testing
      if (MOCK_CHEST_OPENING) {
        return MOCK_CHESTS as MergedNftData[];
      }

      if (!address) {
        return [];
      }

      const lootChestAddress = getLootChestsAddress();
      if (!lootChestAddress) {
        console.warn("Loot chest contract address not configured");
        return [];
      }

      console.log({ lootChestAddress });

      try {
        const tokenBalances = await fetchLootChestBalances(lootChestAddress, address);

        // Map to MergedNftData format
        return tokenBalances.map((token) => ({
          token_id: token.token_id,
          balance: token.balance,
          contract_address: token.contract_address,
          account_address: token.account_address,
          name: token.name,
          symbol: token.symbol,
          expiration: token.expiration,
          best_price_hex: token.best_price_hex,
          metadata: token.metadata,
          order_id: token.order_id,
        }));
      } catch (error) {
        console.error("Failed to fetch owned chests:", error);
        throw error;
      }
    },
    enabled: !!address || MOCK_CHEST_OPENING,
    staleTime: 30_000, // Cache for 30 seconds
    refetchInterval: 60_000, // Refetch every minute
  });

  return {
    ownedChests,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
