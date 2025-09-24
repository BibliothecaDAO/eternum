import { useMemo } from "react";
import { useAccount, useCall } from "@starknet-react/core";
import type { Abi } from "starknet";
import { CallData, uint256 } from "starknet";
import { configManager, LordsAbi, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "./context";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

const DEFAULT_REFETCH_INTERVAL_MS = 5_000;

const normalizeUint256 = (value: unknown): bigint => {
  if (!value) return 0n;

  if (typeof value === "bigint") return value;

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [low, high] = value;
      return BigInt(low ?? 0) + (BigInt(high ?? 0) << 128n);
    }
    if (value.length === 1) {
      return BigInt(value[0] ?? 0);
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeUint = value as { low?: bigint | number | string; high?: bigint | number | string };
    if (maybeUint.low !== undefined && maybeUint.high !== undefined) {
      return BigInt(maybeUint.low) + (BigInt(maybeUint.high) << 128n);
    }
  }

  try {
    return BigInt(value as string);
  } catch (error) {
    console.warn("Failed to normalise uint256", value, error);
    return 0n;
  }
};

interface UseEntryTokenBalanceOptions {
  refetchInterval?: number;
}

interface EntryTokenBalanceResult {
  balance: bigint;
  entryTokenAddress?: `0x${string}`;
  hasEntryTokenContract: boolean;
  isLoading: boolean;
  refetch?: () => Promise<unknown>;
  getEntryTokenIdByIndex: (
    ownerAddress?: string,
    options?: {
      entryTokenAddress?: `0x${string}`;
      validate?: (tokenId: bigint) => boolean | Promise<boolean>;
      onDebug?: (message: string, context?: Record<string, unknown>) => void;
    },
    index?: bigint,
  ) => Promise<bigint | null>;
}

export const useEntryTokenBalance = ({
  refetchInterval = DEFAULT_REFETCH_INTERVAL_MS,
}: UseEntryTokenBalanceOptions = {}): EntryTokenBalanceResult => {
  const { account } = useAccount();
  const { network, setup } = useDojo();

  const blitzRegistrationConfig = configManager.getBlitzConfig()?.blitz_registration_config as
    | { entry_token_address?: bigint }
    | undefined;

  const entryTokenAddressBigInt = blitzRegistrationConfig?.entry_token_address ?? 0n;
  const hasEntryTokenContract = entryTokenAddressBigInt !== 0n;
  const entryTokenAddress = hasEntryTokenContract ? (toHexString(entryTokenAddressBigInt) as `0x${string}`) : undefined;

  const callResult = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: (entryTokenAddress ?? "0x0") as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval,
    enabled: Boolean(account?.address && entryTokenAddress),
  });

  const balance = useMemo(() => normalizeUint256(callResult.data), [callResult.data]);

  const getEntryTokenIdByIndex: EntryTokenBalanceResult["getEntryTokenIdByIndex"] = async (
    ownerAddress = account?.address,
    options,
    indexOverride,
  ) => {
    const targetEntryTokenAddress = options?.entryTokenAddress ?? entryTokenAddress;
    const starknetProvider = network?.provider?.provider;
    if (!ownerAddress || !targetEntryTokenAddress || !starknetProvider) {
      options?.onDebug?.("Entry token lookup skipped", {
        ownerAddress,
        targetEntryTokenAddress,
        hasProvider: Boolean(starknetProvider),
      });
      return null;
    }

    const indexBigInt = indexOverride ?? 0n;
    const index = uint256.bnToUint256(indexBigInt);
    const calldata = CallData.compile([ownerAddress, index.low, index.high]);

    const callResult = await starknetProvider.callContract({
      contractAddress: targetEntryTokenAddress,
      entrypoint: "token_of_owner_by_index",
      calldata,
    });

    const [low, high] = callResult ?? [];
    if (!low || !high) return null;

    const tokenId = BigInt(low) + (BigInt(high) << 128n);
    if (tokenId === 0n) return null;

    if (options?.validate) {
      const isValid = await options.validate(tokenId);
      if (!isValid) return null;
    } else if (setup?.components?.BlitzEntryTokenRegister) {
      const registerRecord = getComponentValue(
        setup.components.BlitzEntryTokenRegister,
        getEntityIdFromKeys([tokenId]),
      );
      if (registerRecord?.registered) {
        return null;
      }
    }

    return tokenId;
  };

  return {
    balance,
    entryTokenAddress,
    hasEntryTokenContract,
    isLoading: callResult.isLoading || !entryTokenAddress,
    refetch: callResult.refetch ? () => callResult.refetch() : undefined,
    getEntryTokenIdByIndex,
  };
};
