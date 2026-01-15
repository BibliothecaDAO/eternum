import { getLordsAddress } from "@/utils/addresses";
import { LordsAbi } from "@bibliothecadao/eternum";
import { getContractByName } from "@dojoengine/core";
import { useCall } from "@starknet-react/core";
import { useMemo } from "react";
import { Abi } from "starknet";
import { dojoConfig } from "../../../../../../../dojo-config";
import { env } from "../../../../../../../env";
import { normalizeUint256 } from "../utils";

export interface UsePrizePoolBalanceReturn {
  prizePoolBalance: bigint;
  prizePoolAddress: string | undefined;
  isLoading: boolean;
  isMainnet: boolean;
  voyagerUrl: string;
}

export function usePrizePoolBalance(): UsePrizePoolBalanceReturn {
  const manifest = dojoConfig.manifest;

  const isMainnet = env.VITE_PUBLIC_CHAIN === "mainnet";

  const prizePoolAddress = useMemo(() => {
    if (!isMainnet || !manifest) return undefined;
    try {
      return getContractByName(manifest, "s1_eternum", "prize_distribution_systems")?.address;
    } catch {
      console.warn("Prize distribution contract not found in manifest");
      return undefined;
    }
  }, [isMainnet, manifest]);

  const lordsAddress = useMemo(() => {
    if (!isMainnet) return undefined;
    return getLordsAddress();
  }, [isMainnet]);

  const balanceCall = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: (lordsAddress ?? "0x0") as `0x${string}`,
    args: [(prizePoolAddress ?? "0x0") as `0x${string}`],
    watch: true,
    refetchInterval: 30_000,
    enabled: isMainnet && !!prizePoolAddress && !!lordsAddress,
  });

  const prizePoolBalance = useMemo(() => normalizeUint256(balanceCall.data), [balanceCall.data]);

  const voyagerUrl = useMemo(() => {
    const baseUrl = env.VITE_PUBLIC_EXPLORER_MAINNET || "https://voyager.online";
    return `${baseUrl}/contract/${prizePoolAddress}`;
  }, [prizePoolAddress]);

  return {
    prizePoolBalance,
    prizePoolAddress,
    isLoading: balanceCall.isLoading,
    isMainnet,
    voyagerUrl,
  };
}
