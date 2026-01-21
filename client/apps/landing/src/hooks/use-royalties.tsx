import { marketplaceCollections } from "@/config";
import { useReadContract } from "@starknet-react/core";
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

// Simple ERC2981 ABI for royalty_info method - Starknet style
const ERC2981_ABI = [
  {
    type: "function",
    name: "royalty_info",
    inputs: [
      {
        name: "token_id",
        type: "core::integer::u256",
      },
      {
        name: "sale_price",
        type: "core::integer::u256",
      },
    ],
    outputs: [
      {
        type: "(core::starknet::contract_address::ContractAddress, core::integer::u256)",
      },
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

  // Read royalty info from contract
  const {
    data: royaltyData,
    isLoading,
    error,
  } = useReadContract({
    abi: ERC2981_ABI,
    address: contractAddress as `0x${string}`,
    functionName: "royalty_info",
    args: [tokenId, salePriceWei.toString()],
    enabled: !!contractAddress && !!tokenId && salePriceWei > 0n,
  });

  // Process royalty data
  const royaltyInfo = useMemo(() => {
    if (!royaltyData) {
      return null;
    }

    // Handle object format from starknet-react (tuple response)
    if (typeof royaltyData === "object" && "0" in royaltyData && "1" in royaltyData) {
      const receiver = royaltyData[0];
      const royaltyAmount = royaltyData[1];

      return {
        receiver: receiver.toString(),
        royaltyAmount: BigInt(royaltyAmount.toString()),
      };
    }
    return null;
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
