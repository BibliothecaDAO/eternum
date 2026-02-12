import { useNetwork, useAccount } from "@starknet-react/core";
import { useReadContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { CONTRACTS, TIME_CONSTANTS, APY_CONSTANTS } from "@/lib/constants";

import { REWARD_POOL_ABI } from "@/lib/abis/rewardPool";
import { VELORDS_ABI } from "@/lib/abis/velords";
import { LORDS_ABI } from "@/lib/abis/lords";
import { lordsInfoQueryOptions } from "@/lib/query-options";

// Helper function to get the current week timestamp (floored to week)
const floorToWeek = (timestamp: number): number => {
  return Math.floor(timestamp / TIME_CONSTANTS.WEEK) * TIME_CONSTANTS.WEEK;
};

// Helper function to convert BigInt to number with decimals
const formatTokenAmount = (amount: bigint, decimals: number = 18): number => {
  return Number(amount) / Math.pow(10, decimals);
};

type StarknetUint256 = {
  low: bigint | number | string;
  high: bigint | number | string;
};

const isStarknetUint256 = (value: unknown): value is StarknetUint256 => {
  return (
    typeof value === "object" &&
    value !== null &&
    "low" in value &&
    "high" in value
  );
};

const isLockData = (value: unknown): value is readonly [unknown, unknown] => {
  return Array.isArray(value) && value.length >= 2;
};

// Helper to safely convert contract response to BigInt
const toBigInt = (value: unknown): bigint => {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "string") return BigInt(value);
    if (typeof value === "number") return BigInt(value);
    if (isStarknetUint256(value)) {
      // Handle Uint256 type from StarkNet
      return BigInt(value.low) + (BigInt(value.high) << 128n);
    }
  } catch (error) {
    console.error("[useVelords] Failed to parse bigint value:", error);
  }

  return 0n;
};

export const useVelords = () => {
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
    chain: chain?.name,
    userAddress,
    currentTimestamp,
    currentWeek,
    lastWeek,
    safeLastWeek,
    protocolStartTime: TIME_CONSTANTS.PROTOCOL_START_TIME,
    protocolStartWeek,
    contracts: {
      VELORDS: CONTRACTS.STARKNET.VELORDS,
      REWARD_POOL: CONTRACTS.STARKNET.REWARD_POOL,
    },
  });

  // Get veLORDS total supply
  const { data: totalSupply, error: totalSupplyError } = useReadContract({
    abi: VELORDS_ABI,
    functionName: "total_supply",
    address: CONTRACTS.STARKNET.VELORDS,
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
    abi: LORDS_ABI,
    functionName: "balance_of",
    address: CONTRACTS.STARKNET.LORDS_TOKEN,
    args: [CONTRACTS.STARKNET.VELORDS],
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
  const { data: lordsPrice } = useQuery(lordsInfoQueryOptions());

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

  // Get tokens distributed this week
  const { data: tokensThisWeek, error: tokensThisWeekError } = useReadContract({
    abi: REWARD_POOL_ABI,
    functionName: "get_tokens_per_week",
    address: CONTRACTS.STARKNET.REWARD_POOL,
    args: [currentWeek],
    enabled: !!chain,
  });

  console.log("[useVelords] Tokens this week:", {
    tokensThisWeek,
    tokensThisWeekError,
    formatted:
      tokensThisWeek !== undefined
        ? formatTokenAmount(toBigInt(tokensThisWeek))
        : "N/A",
  });

  // Get tokens distributed last week
  const { data: tokensLastWeek, error: tokensLastWeekError } = useReadContract({
    abi: REWARD_POOL_ABI,
    functionName: "get_tokens_per_week",
    address: CONTRACTS.STARKNET.REWARD_POOL,
    args: [safeLastWeek],
    enabled: !!chain,
  });

  console.log("[useVelords] Tokens last week:", {
    tokensLastWeek,
    tokensLastWeekError,
    weekQueried: safeLastWeek,
    formatted:
      tokensLastWeek !== undefined
        ? formatTokenAmount(toBigInt(tokensLastWeek))
        : "N/A",
  });

  // Get veLORDS supply for this week
  const { data: veSupplyThisWeek, error: veSupplyThisWeekError } =
    useReadContract({
      abi: REWARD_POOL_ABI,
      functionName: "get_ve_supply",
      address: CONTRACTS.STARKNET.REWARD_POOL,
      args: [currentWeek],
      enabled: !!chain,
    });

  console.log("[useVelords] VE supply this week:", {
    veSupplyThisWeek,
    veSupplyThisWeekError,
    formatted:
      veSupplyThisWeek !== undefined
        ? formatTokenAmount(toBigInt(veSupplyThisWeek))
        : "N/A",
  });

  // Get veLORDS supply for last week
  const { data: veSupplyLastWeek, error: veSupplyLastWeekError } =
    useReadContract({
      abi: REWARD_POOL_ABI,
      functionName: "get_ve_supply",
      address: CONTRACTS.STARKNET.REWARD_POOL,
      args: [safeLastWeek],
      enabled: !!chain,
    });

  console.log("[useVelords] VE supply last week:", {
    veSupplyLastWeek,
    veSupplyLastWeekError,
    weekQueried: safeLastWeek,
    formatted:
      veSupplyLastWeek !== undefined
        ? formatTokenAmount(toBigInt(veSupplyLastWeek))
        : "N/A",
  });

  // Get user's veLORDS balance if connected
  const { data: userBalance, error: userBalanceError } = useReadContract({
    abi: VELORDS_ABI,
    functionName: "balance_of",
    address: CONTRACTS.STARKNET.VELORDS,
    args: [userAddress!],
    enabled: !!chain && !!userAddress,
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
    abi: VELORDS_ABI,
    functionName: "get_lock_for",
    address: CONTRACTS.STARKNET.VELORDS,
    args: [userAddress!],
    enabled: !!chain && !!userAddress,
  });

  const parsedUserLocked = isLockData(userLocked)
    ? {
        amount: formatTokenAmount(toBigInt(userLocked[0])),
        unlockTime: Number(userLocked[1]),
      }
    : undefined;

  console.log("[useVelords] User locked:", {
    userLocked,
    userLockedError,
    formatted: parsedUserLocked ?? "N/A",
  });

  // Calculate APY based on weekly rewards
  const calculateAPY = useQuery({
    queryKey: [
      "velords-apy",
      tokensThisWeek?.toString(),
      tokensLastWeek?.toString(),
      veSupplyThisWeek?.toString(),
      veSupplyLastWeek?.toString(),
    ],
    queryFn: () => {
      console.log("[useVelords] Calculating APY with:", {
        tokensThisWeek,
        tokensLastWeek,
        veSupplyThisWeek,
        veSupplyLastWeek,
      });

      if (
        tokensThisWeek === undefined ||
        tokensLastWeek === undefined ||
        veSupplyThisWeek === undefined ||
        veSupplyLastWeek === undefined
      ) {
        console.log("[useVelords] APY calculation skipped - missing data");
        return null;
      }

      // Use average of this week and last week for more stable APY
      const avgTokensPerWeek =
        (toBigInt(tokensThisWeek) + toBigInt(tokensLastWeek)) / 2n;
      const avgVeSupply =
        (toBigInt(veSupplyThisWeek) + toBigInt(veSupplyLastWeek)) / 2n;

      console.log("[useVelords] APY calculation intermediates:", {
        avgTokensPerWeek: avgTokensPerWeek.toString(),
        avgVeSupply: avgVeSupply.toString(),
      });

      if (avgVeSupply === 0n) {
        console.log("[useVelords] APY calculation failed - zero supply");
        return 0;
      }

      // Calculate weekly yield
      const weeklyYield =
        Number((avgTokensPerWeek * 10000n) / avgVeSupply) / 10000;

      // Annualize (52 weeks)
      const annualYield = weeklyYield * APY_CONSTANTS.BLOCKS_PER_YEAR;

      // Convert to percentage
      const apy = annualYield * 100;

      console.log("[useVelords] APY calculated:", {
        weeklyYield,
        annualYield,
        apy,
      });

      return apy;
    },
    enabled:
      tokensThisWeek !== undefined &&
      tokensLastWeek !== undefined &&
      veSupplyThisWeek !== undefined &&
      veSupplyLastWeek !== undefined,
    staleTime: 60000, // Cache for 1 minute
  });

  // Calculate user's expected weekly rewards
  const userWeeklyRewards = useQuery({
    queryKey: [
      "user-weekly-rewards",
      userBalance?.toString(),
      tokensThisWeek?.toString(),
      veSupplyThisWeek?.toString(),
    ],
    queryFn: () => {
      console.log("[useVelords] Calculating user rewards with:", {
        userBalance,
        tokensThisWeek,
        veSupplyThisWeek,
      });

      if (
        userBalance === undefined ||
        tokensThisWeek === undefined ||
        veSupplyThisWeek === undefined
      ) {
        console.log(
          "[useVelords] User rewards calculation skipped - missing data"
        );
        return 0;
      }

      const veSupplyBigInt = toBigInt(veSupplyThisWeek);
      if (veSupplyBigInt === 0n) {
        console.log(
          "[useVelords] User rewards calculation failed - zero supply"
        );
        return 0;
      }

      const userShare =
        (toBigInt(userBalance) * toBigInt(tokensThisWeek)) / veSupplyBigInt;
      const rewards = formatTokenAmount(userShare);

      console.log("[useVelords] User rewards calculated:", {
        userShare: userShare.toString(),
        rewards,
      });

      return rewards;
    },
    enabled:
      userBalance !== undefined &&
      tokensThisWeek !== undefined &&
      veSupplyThisWeek !== undefined,
    staleTime: 60000, // Cache for 1 minute
  });

  // Get historical APY data for charting
  const historicalAPY = useQuery({
    queryKey: ["historical-apy", currentWeek],
    queryFn: async () => {
      const weeks = 12; // Last 12 weeks
      const data = [];

      for (let i = 0; i < weeks; i++) {
        const week = currentWeek - i * TIME_CONSTANTS.WEEK;

        // This would need to be implemented with multicall or batch requests
        // For now, returning mock data structure
        data.push({
          week,
          apy: 0,
          tokensDistributed: 0,
          veSupply: 0,
        });
      }

      return data.reverse();
    },
    enabled: false, // Disabled until proper implementation
    staleTime: 300000, // Cache for 5 minutes when enabled
  });

  console.log("[useVelords] APY calculation result:", calculateAPY.data);

  const result = {
    // Supply data
    totalSupply:
      totalSupply !== undefined
        ? formatTokenAmount(toBigInt(totalSupply))
        : undefined,
    veSupplyThisWeek:
      veSupplyThisWeek !== undefined
        ? formatTokenAmount(toBigInt(veSupplyThisWeek))
        : undefined,
    lordsLocked:
      lordsInVelords !== undefined
        ? formatTokenAmount(toBigInt(lordsInVelords))
        : undefined,

    // Rewards data
    tokensThisWeek:
      tokensThisWeek !== undefined
        ? formatTokenAmount(toBigInt(tokensThisWeek))
        : undefined,
    tokensLastWeek:
      tokensLastWeek !== undefined
        ? formatTokenAmount(toBigInt(tokensLastWeek))
        : undefined,

    // APY data
    currentAPY: calculateAPY.data,
    isAPYLoading: calculateAPY.isLoading,

    // TVL data
    tvl: tvl.data,
    isTVLLoading: tvl.isLoading,
    lordsPrice: lordsPrice?.price?.rate,

    // User data
    userBalance:
      userBalance !== undefined
        ? formatTokenAmount(toBigInt(userBalance))
        : undefined,
    userLocked: parsedUserLocked,
    userWeeklyRewards: userWeeklyRewards.data,

    // Historical data
    historicalAPY: historicalAPY.data,

    // Helper functions
    floorToWeek,
    formatTokenAmount,
  };

  console.log("[useVelords] Final return value:", result);

  return result;
};
