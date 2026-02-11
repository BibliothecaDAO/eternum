import { L2_C1ERC20 } from "@/abi/L2/C1ERC20";
import { VeLords } from "@/abi/L2/VeLords";
import { TIME_CONSTANTS } from "@/lib/constants";
import { getLordsInfo } from "@/lib/getLordsPrice";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount, useNetwork, useReadContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";

import { LORDS, StakingAddresses } from "@realms-world/constants";

// Helper function to get the current week timestamp (floored to week)
const floorToWeek = (timestamp: number): number => {
  return Math.floor(timestamp / TIME_CONSTANTS.WEEK) * TIME_CONSTANTS.WEEK;
};

// Helper function to convert BigInt to number with decimals
const formatTokenAmount = (amount: bigint, decimals: number = 18): number => {
  return Number(amount) / Math.pow(10, decimals);
};

// Helper to safely convert contract response to BigInt
const toBigInt = (value: any): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  if (typeof value === "number") return BigInt(value);
  if (value && typeof value === "object") {
    // Handle Uint256 type from StarkNet
    if ("low" in value && "high" in value) {
      return BigInt(value.low) + (BigInt(value.high) << 128n);
    }
  }
  return 0n;
};

export const useVelordsData = () => {
  const { chain } = useNetwork();
  const { address: userAddress } = useAccount();

  // Get veLORDS total supply
  const { data: totalSupply } = useReadContract({
    abi: VeLords,
    functionName: "total_supply",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: [],
    enabled: !!chain,
  });

  // Get LORDS balance in veLORDS contract
  const { data: lordsInVelords } = useReadContract({
    abi: L2_C1ERC20,
    functionName: "balance_of",
    address: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as `0x${string}`,
    args: [StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`],
    enabled: !!chain,
  });

  // Get LORDS price for TVL calculation
  const { data: lordsPrice } = useQuery({
    queryKey: ["lordsPrice"],
    queryFn: () => getLordsInfo({}),
    staleTime: 60000, // Cache for 1 minute
  });

  // Calculate TVL
  const tvl = useQuery({
    queryKey: [
      "velords-tvl",
      lordsInVelords?.toString(),
      lordsPrice?.price?.rate,
    ],
    queryFn: () => {
      if (!lordsInVelords || !lordsPrice?.price?.rate) {
        return null;
      }

      const lordsAmount = formatTokenAmount(toBigInt(lordsInVelords));
      const price =
        typeof lordsPrice.price.rate === "string"
          ? parseFloat(lordsPrice.price.rate)
          : lordsPrice.price.rate;

      return lordsAmount * price;
    },
    enabled: !!lordsInVelords && !!lordsPrice?.price?.rate,
    staleTime: 60000, // Cache for 1 minute
  });

  // Get user's veLORDS balance if connected
  const { data: userBalance } = useReadContract({
    abi: VeLords,
    functionName: "balance_of",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: userAddress && [userAddress],
    enabled: !!userAddress,
  });

  // Get user's locked LORDS info
  const { data: userLocked } = useReadContract({
    abi: VeLords,
    functionName: "get_lock_for",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: [userAddress!],
    enabled: !!chain && !!userAddress,
  });

  const result = {
    // Supply data
    totalSupply:
      totalSupply !== undefined
        ? formatTokenAmount(toBigInt(totalSupply))
        : undefined,
    lordsLocked:
      lordsInVelords !== undefined
        ? formatTokenAmount(toBigInt(lordsInVelords))
        : undefined,

    // TVL data
    tvl: tvl.data,
    isTVLLoading: tvl.isLoading,
    lordsPrice: lordsPrice?.price?.rate,

    // User data
    userBalance:
      userBalance !== undefined
        ? formatTokenAmount(toBigInt(userBalance))
        : undefined,
    userLocked: userLocked
      ? {
          amount: formatTokenAmount(toBigInt((userLocked as any)[0])),
          unlockTime: Number((userLocked as any)[1]),
        }
      : undefined,

    // Helper functions
    floorToWeek,
    formatTokenAmount,
  };

  return result;
};
