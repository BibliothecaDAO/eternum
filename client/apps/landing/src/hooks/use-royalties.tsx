import { marketplaceCollections } from "@/config";
import { useContract, useReadContract } from "@starknet-react/core";
import { useMemo } from "react";
import { parseUnits } from "viem";

interface RoyaltyInfo {
  receiver: string;
  royaltyAmount: bigint;
}

interface UseRoyaltiesParams {
  collection: keyof typeof marketplaceCollections;
  tokenId: string;
  salePrice: string; // Price in ETH/Lords as string
}

interface UseRoyaltiesReturn {
  royaltyInfo: RoyaltyInfo | null;
  royaltyPercentage: number;
  sellerProceeds: bigint;
  marketplaceFee: bigint;
  totalPrice: bigint;
  isLoading: boolean;
  error: Error | null;
}

// Simple ERC2981 ABI for royalty_info method
const ERC2981_ABI = [
  {
    name: "royalty_info",
    type: "function",
    inputs: [
      { name: "token_id", type: "felt252" },
      { name: "sale_price", type: "felt252" },
    ],
    outputs: [
      { name: "receiver", type: "felt252" },
      { name: "royalty_amount", type: "felt252" },
    ],
    state_mutability: "view",
  },
] as const;

const MARKETPLACE_FEE_PERCENT = 2.5;

export const useRoyalties = ({ collection, tokenId, salePrice }: UseRoyaltiesParams): UseRoyaltiesReturn => {
  const collectionData = marketplaceCollections[collection];
  const contractAddress = collectionData?.address;

  // Convert sale price to wei
  const salePriceWei = useMemo(() => {
    try {
      return parseUnits(salePrice || "0", 18);
    } catch {
      return BigInt(0);
    }
  }, [salePrice]);

  // Calculate marketplace fee
  const marketplaceFee = useMemo(() => {
    return (salePriceWei * BigInt(Math.floor(MARKETPLACE_FEE_PERCENT * 100))) / BigInt(10000);
  }, [salePriceWei]);

  // Get contract instance
  const { contract } = useContract({
    abi: ERC2981_ABI,
    address: contractAddress as `0x${string}`,
  });

  // Read royalty info from contract
  const { data: royaltyData, isLoading, error } = useReadContract({
    contract: contract || undefined,
    functionName: "royalty_info",
    args: [tokenId, salePriceWei.toString()],
    enabled: !!contract && !!tokenId && salePriceWei > 0n,
  });

  // Process royalty data
  const royaltyInfo = useMemo(() => {
    if (!royaltyData || !Array.isArray(royaltyData) || royaltyData.length < 2) {
      return null;
    }

    return {
      receiver: royaltyData[0] as string,
      royaltyAmount: BigInt(royaltyData[1] as string),
    };
  }, [royaltyData]);

  // Calculate royalty percentage
  const royaltyPercentage = useMemo(() => {
    if (!royaltyInfo || salePriceWei === 0n) {
      return 0;
    }
    return Number((royaltyInfo.royaltyAmount * BigInt(10000)) / salePriceWei) / 100;
  }, [royaltyInfo, salePriceWei]);

  // Calculate seller proceeds (after marketplace fee and royalty)
  const sellerProceeds = useMemo(() => {
    const royaltyAmount = royaltyInfo?.royaltyAmount || 0n;
    return salePriceWei - marketplaceFee - royaltyAmount;
  }, [salePriceWei, marketplaceFee, royaltyInfo]);

  return {
    royaltyInfo,
    royaltyPercentage,
    sellerProceeds,
    marketplaceFee,
    totalPrice: salePriceWei,
    isLoading,
    error: error as Error | null,
  };
};

// Hook to get royalties for multiple tokens (useful for batch purchases)
export const useBatchRoyalties = (
  tokens: Array<{ collection: keyof typeof marketplaceCollections; tokenId: string; salePrice: string }>,
) => {
  const royalties = tokens.map((token) => useRoyalties(token));

  const totalRoyalties = useMemo(() => {
    return royalties.reduce(
      (acc, royalty) => ({
        totalRoyaltyAmount: acc.totalRoyaltyAmount + (royalty.royaltyInfo?.royaltyAmount || 0n),
        totalMarketplaceFee: acc.totalMarketplaceFee + royalty.marketplaceFee,
        totalSellerProceeds: acc.totalSellerProceeds + royalty.sellerProceeds,
        totalPrice: acc.totalPrice + royalty.totalPrice,
      }),
      {
        totalRoyaltyAmount: 0n,
        totalMarketplaceFee: 0n,
        totalSellerProceeds: 0n,
        totalPrice: 0n,
      },
    );
  }, [royalties]);

  const isLoading = royalties.some((r) => r.isLoading);
  const hasError = royalties.some((r) => r.error);

  return {
    royalties,
    totalRoyalties,
    isLoading,
    hasError,
  };
};