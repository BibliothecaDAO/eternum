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

  // Get current timestamp
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const currentWeek = floorToWeek(currentTimestamp);
  const lastWeek = currentWeek - TIME_CONSTANTS.WEEK;

  // Ensure we don't query before protocol start
  const protocolStartWeek = floorToWeek(TIME_CONSTANTS.PROTOCOL_START_TIME);
  const safeLastWeek = Math.max(lastWeek, protocolStartWeek);

  console.log("[useVelords] Hook initialized:", {
    chain: chain.name,
    userAddress,
    currentTimestamp,
    currentWeek,
    lastWeek,
    safeLastWeek,
    protocolStartTime: TIME_CONSTANTS.PROTOCOL_START_TIME,
    protocolStartWeek,
    contracts: {
      VELORDS: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID],
      REWARD_POOL: StakingAddresses.rewardpool[SUPPORTED_L2_CHAIN_ID],
    },
  });

  // Get veLORDS total supply
  const { data: totalSupply, error: totalSupplyError } = useReadContract({
    abi: VeLords,
    functionName: "total_supply",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: [],
    enabled: !!chain,
  });

  console.log("[useVelords] Total supply:", {
    totalSupply,
    totalSupplyError,
    formatted:
      totalSupply !== undefined
        ? formatTokenAmount(toBigInt(totalSupply))
        : "N/A",
  });

  // Get LORDS balance in veLORDS contract
  const { data: lordsInVelords, error: lordsInVelordsError } = useReadContract({
    abi: L2_C1ERC20,
    functionName: "balance_of",
    address: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as `0x${string}`,
    args: [StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`],
    enabled: !!chain,
  });

  console.log("[useVelords] LORDS in veLORDS:", {
    lordsInVelords,
    lordsInVelordsError,
    formatted:
      lordsInVelords !== undefined
        ? formatTokenAmount(toBigInt(lordsInVelords))
        : "N/A",
  });

  // Get LORDS price for TVL calculation
  const { data: lordsPrice } = useQuery({
    queryKey: ["lordsPrice"],
    queryFn: () => getLordsInfo({}),
    staleTime: 60000, // Cache for 1 minute
  });

  console.log("[useVelords] Price query data:", {
    lordsPrice,
    hasPrice: !!lordsPrice?.price?.rate,
    hasLordsInVelords: !!lordsInVelords,
  });

  // Calculate TVL
  const tvl = useQuery({
    queryKey: [
      "velords-tvl",
      lordsInVelords?.toString(),
      lordsPrice?.price?.rate,
    ],
    queryFn: () => {
      console.log('here')
      if (!lordsInVelords || !lordsPrice?.price?.rate) {
        return null;
      }

      const lordsAmount = formatTokenAmount(toBigInt(lordsInVelords));
      const price =
        typeof lordsPrice.price.rate === "string"
          ? parseFloat(lordsPrice.price.rate)
          : lordsPrice.price.rate;

      const tvlValue = lordsAmount * price;

      console.log("[useVelords] TVL calculation:", {
        lordsAmount,
        price,
        tvl: tvlValue,
      });

      return tvlValue;
    },
    enabled: !!lordsInVelords && !!lordsPrice?.price?.rate,
    staleTime: 60000, // Cache for 1 minute
  });


  // Get user's veLORDS balance if connected
  const { data: userBalance, error: userBalanceError } = useReadContract({
    abi: VeLords,
    functionName: "balance_of",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: userAddress && [userAddress],
    enabled: !!userAddress,
  });

  console.log("[useVelords] User balance:", {
    userBalance,
    userBalanceError,
    formatted:
      userBalance !== undefined
        ? formatTokenAmount(toBigInt(userBalance))
        : "N/A",
  });

  // Get user's locked LORDS info
  const { data: userLocked, error: userLockedError } = useReadContract({
    abi: VeLords,
    functionName: "get_lock_for",
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    args: [userAddress!],
    enabled: !!chain && !!userAddress,
  });

  console.log("[useVelords] User locked:", {
    userLocked,
    userLockedError,
    formatted: userLocked
      ? {
          amount: formatTokenAmount(toBigInt((userLocked as any)[0])),
          unlockTime: Number((userLocked as any)[1]),
        }
      : "N/A",
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

  console.log("[useVelords] Final return value:", result);

  return result;
};
