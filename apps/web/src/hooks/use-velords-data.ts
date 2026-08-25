import { L2_C1ERC20 } from "@/abi/L2/C1ERC20";
import { VeLords } from "@/abi/L2/VeLords";
import { TIME_CONSTANTS } from "@/lib/constants";
import { getLordsInfo } from "@/lib/getLordsPrice";
import {
  calculateSharePercent,
  computeTvlUsd,
  formatTokenAmountDisplay,
  toBigInt,
} from "@/lib/velords-utils";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount, useNetwork, useReadContract } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";

import { LORDS, StakingAddresses } from "@realms-world/constants";

// Helper function to get the current week timestamp (floored to week)
const floorToWeek = (timestamp: number): number => {
  return Math.floor(timestamp / TIME_CONSTANTS.WEEK) * TIME_CONSTANTS.WEEK;
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
    args: userAddress ? [userAddress] : undefined,
    enabled: !!userAddress,
  });

  const totalSupplyRaw = totalSupply !== undefined ? toBigInt(totalSupply) : undefined;
  const lordsLockedRaw =
    lordsInVelords !== undefined ? toBigInt(lordsInVelords) : undefined;
  const userBalanceRaw =
    userBalance !== undefined ? toBigInt(userBalance) : undefined;
  const userLockedData = userLocked as
    | {
        amount?: unknown;
        end_time?: unknown;
        0?: unknown;
        1?: unknown;
      }
    | undefined;
  const userLockedRaw =
    userLockedData !== undefined
      ? {
          amount: toBigInt(userLockedData.amount ?? userLockedData[0]),
          unlockTime: Number(userLockedData.end_time ?? userLockedData[1] ?? 0),
        }
      : undefined;

  const tvl = computeTvlUsd(lordsInVelords, lordsPrice?.price?.rate);
  const isTVLLoading = lordsInVelords === undefined || lordsPrice === undefined;

  const result = {
    // Supply data
    totalSupplyRaw,
    lordsLockedRaw,
    totalSupply:
      totalSupplyRaw !== undefined
        ? formatTokenAmountDisplay(totalSupplyRaw, { maximumFractionDigits: 0 })
        : undefined,
    lordsLocked:
      lordsLockedRaw !== undefined
        ? formatTokenAmountDisplay(lordsLockedRaw, { maximumFractionDigits: 0 })
        : undefined,

    // TVL data
    tvl,
    isTVLLoading,
    lordsPrice: lordsPrice?.price?.rate,

    // User data
    userBalanceRaw,
    userBalance:
      userBalanceRaw !== undefined
        ? formatTokenAmountDisplay(userBalanceRaw, { maximumFractionDigits: 2 })
        : undefined,
    userSharePercent:
      userBalanceRaw !== undefined && totalSupplyRaw !== undefined
        ? calculateSharePercent(userBalanceRaw, totalSupplyRaw)
        : undefined,
    userLocked: userLockedRaw
      ? {
          amount: formatTokenAmountDisplay(userLockedRaw.amount, {
            maximumFractionDigits: 2,
          }),
          unlockTime: userLockedRaw.unlockTime,
        }
      : undefined,

    // Helper functions
    floorToWeek,
  };

  return result;
};
