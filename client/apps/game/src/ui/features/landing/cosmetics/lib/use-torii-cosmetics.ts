import { fetchTokenBalancesWithMetadata } from "@/ui/features/landing/chest-opening/services";
import { getCosmeticsAddress } from "@/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export interface CosmeticMetadataAttribute {
  trait_type: string;
  value: string;
}

export interface CosmeticMetadata {
  attributes?: CosmeticMetadataAttribute[];
  description?: string;
  image?: string;
  name?: string;
}

export interface ToriiCosmeticAsset {
  accountAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenId: string | null;
  balance: string;
  decimals: number;
  metadata: CosmeticMetadata | null;
}

interface UseToriiCosmeticsOptions extends Pick<UseQueryOptions<ToriiCosmeticAsset[], Error>, "staleTime" | "enabled"> {
  accountAddress?: string;
}

export const useToriiCosmetics = (options: UseToriiCosmeticsOptions = {}) => {
  const { enabled = true, staleTime = 60_000 } = options;
  const { address: connectedAddress } = useAccount();

  // Use connected wallet address, or fall back to provided address
  const accountAddress = options.accountAddress ?? connectedAddress;
  const isEnabled = enabled && Boolean(accountAddress);

  return useQuery({
    queryKey: ["torii", "cosmetics", accountAddress],
    queryFn: async (): Promise<ToriiCosmeticAsset[]> => {
      if (!accountAddress) {
        return [];
      }

      const cosmeticsAddress = getCosmeticsAddress();
      if (!cosmeticsAddress) {
        console.warn("Cosmetics contract address not configured");
        return [];
      }

      const tokenBalances = await fetchTokenBalancesWithMetadata(cosmeticsAddress, accountAddress);

      // Map to ToriiCosmeticAsset format
      return tokenBalances.map((token) => ({
        accountAddress: token.account_address,
        tokenName: token.name ?? "",
        tokenSymbol: token.symbol ?? "",
        tokenId: token.token_id,
        balance: token.balance,
        decimals: 0,
        metadata: token.metadata as CosmeticMetadata | null,
      }));
    },
    enabled: isEnabled,
    staleTime,
  });
};
