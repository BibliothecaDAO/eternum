import { getLordsAddress } from "@/utils/addresses";
import { configManager, LordsAbi, toHexString } from "@bibliothecadao/eternum";
import { useDojo, useEntryTokenBalance } from "@bibliothecadao/react";
import { useCall } from "@starknet-react/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Abi, AccountInterface, CallData, uint256 } from "starknet";
import { env } from "../../../../../../../env";
import { EntryTokenStatus } from "../types";
import { normalizeUint256 } from "../utils";

export interface UseEntryTokensReturn {
  // Entry token state
  entryTokenBalance: bigint;
  availableEntryTokenIds: bigint[];
  selectedEntryTokenId: bigint | null;
  setSelectedEntryTokenId: (id: bigint | null) => void;
  isLoadingEntryTokens: boolean;
  entryTokenStatus: EntryTokenStatus;

  // Fee token state
  feeTokenBalance: bigint;
  feeAmount: bigint;
  feeTokenAddressHex: string | undefined;
  feeTokenSymbol: string;
  hasSufficientFeeBalance: boolean;
  isFeeBalanceLoading: boolean;

  // Derived state
  requiresEntryToken: boolean;
  tokenReady: boolean;

  // Actions
  loadAvailableEntryTokens: () => Promise<void>;
  obtainEntryToken: () => Promise<void>;
  refetchEntryTokenBalance: (() => void) | undefined;
  refetchFeeTokenBalance: (() => void) | undefined;
}

export function useEntryTokens(account: AccountInterface | undefined): UseEntryTokensReturn {
  const {
    setup: { systemCalls },
    network,
    masterAccount,
  } = useDojo();

  const accountAddress = account?.address;

  const blitzConfig = configManager.getBlitzConfig()?.blitz_registration_config;
  const {
    balance: entryTokenBalance,
    hasEntryTokenContract,
    refetch: refetchEntryTokenBalance,
    getEntryTokenIdByIndex,
  } = useEntryTokenBalance();

  const [availableEntryTokenIds, setAvailableEntryTokenIds] = useState<bigint[]>([]);
  const [selectedEntryTokenId, setSelectedEntryTokenId] = useState<bigint | null>(null);
  const [isLoadingEntryTokens, setIsLoadingEntryTokens] = useState(false);
  const [entryTokenStatus, setEntryTokenStatus] = useState<EntryTokenStatus>("idle");

  // Extract primitive values to use as stable dependencies
  const entryTokenAddress = blitzConfig?.entry_token_address;
  const configFeeAmount = blitzConfig?.fee_amount;
  const configFeeToken = blitzConfig?.fee_token;

  const requiresEntryToken = useMemo(() => {
    if (configFeeAmount === undefined) return false;
    return hasEntryTokenContract && configFeeAmount > 0n;
  }, [configFeeAmount, hasEntryTokenContract]);

  const feeAmount = configFeeAmount ?? 0n;
  const feeTokenAddressHex = useMemo(
    () => (configFeeToken !== undefined && configFeeAmount !== undefined && configFeeAmount > 0n ? toHexString(configFeeToken) : undefined),
    [configFeeToken, configFeeAmount],
  );

  // Determine if fee token is LORDS
  const feeTokenSymbol = useMemo(() => {
    if (!feeTokenAddressHex) return "TOKEN";
    const lordsAddress = getLordsAddress();
    if (!lordsAddress || typeof lordsAddress !== "string") return "TOKEN";
    // Normalize addresses for comparison (lowercase, remove leading zeros after 0x)
    const normalizeAddr = (addr: string) => addr.toLowerCase().replace(/^0x0+/, "0x");
    return normalizeAddr(feeTokenAddressHex) === normalizeAddr(lordsAddress) ? "LORDS" : "TOKEN";
  }, [feeTokenAddressHex]);

  const feeTokenCall = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: (feeTokenAddressHex ?? "0x0") as `0x${string}`,
    args: [(accountAddress as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval: 5_000,
    enabled: Boolean(accountAddress && feeTokenAddressHex),
  });

  const feeTokenBalance = useMemo(() => normalizeUint256(feeTokenCall.data), [feeTokenCall.data]);
  const refetchFeeTokenBalance = feeTokenCall.refetch ? () => feeTokenCall.refetch() : undefined;
  const isFeeBalanceLoading = feeTokenCall.isLoading && Boolean(feeTokenAddressHex);
  const hasSufficientFeeBalance = !requiresEntryToken || feeAmount === 0n || feeTokenBalance >= feeAmount;
  const tokenReady = !requiresEntryToken || availableEntryTokenIds.length > 0;

  const loadAvailableEntryTokens = useCallback(async () => {
    if (!requiresEntryToken || entryTokenAddress === undefined || !accountAddress || entryTokenBalance === 0n) {
      setAvailableEntryTokenIds([]);
      setSelectedEntryTokenId(null);
      return;
    }

    setIsLoadingEntryTokens(true);
    try {
      const maxTokens =
        entryTokenBalance > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(entryTokenBalance);
      const entryTokenAddressHex = toHexString(entryTokenAddress) as `0x${string}`;
      const ids: bigint[] = [];

      const maxToShow = Math.min(maxTokens, 16);
      for (let i = 0; i < maxToShow; i++) {
        const tokenId = await getEntryTokenIdByIndex(
          accountAddress,
          {
            entryTokenAddress: entryTokenAddressHex,
            onDebug: (message, context) => console.debug(`[EntryTokenList] ${message}`, context),
          },
          BigInt(i),
        );
        if (tokenId && !ids.includes(tokenId)) {
          ids.push(tokenId);
        }
      }

      setAvailableEntryTokenIds(ids);
      if (!ids.length) {
        setEntryTokenStatus("timeout");
      } else {
        setEntryTokenStatus("idle");
      }
    } catch (error) {
      console.error("Failed to load entry tokens", error);
      setEntryTokenStatus("error");
    } finally {
      setIsLoadingEntryTokens(false);
    }
  }, [accountAddress, entryTokenAddress, entryTokenBalance, requiresEntryToken, getEntryTokenIdByIndex]);

  const obtainEntryToken = useCallback(async () => {
    if (!account || !accountAddress || !requiresEntryToken || configFeeToken === undefined || configFeeAmount === undefined) return;

    setEntryTokenStatus("minting");
    try {
      // Auto top-up on non-mainnet if fee balance is insufficient
      const isNonMainnet = env.VITE_PUBLIC_CHAIN !== "mainnet";
      const feeTokenAddr = toHexString(configFeeToken);
      if (
        isNonMainnet &&
        network?.provider &&
        masterAccount &&
        feeTokenAddr &&
        feeAmount > 0n &&
        feeTokenBalance < feeAmount
      ) {
        const shortfall = feeAmount - feeTokenBalance;
        const amount = uint256.bnToUint256(shortfall);
        await network.provider.executeAndCheckTransaction(masterAccount, {
          contractAddress: feeTokenAddr,
          entrypoint: "transfer",
          calldata: CallData.compile([accountAddress, amount.low, amount.high]),
        });
        await refetchFeeTokenBalance?.();
      }

      await systemCalls.blitz_realm_obtain_entry_token({
        signer: account,
        feeToken: feeTokenAddr,
        feeAmount: configFeeAmount,
      });

      await refetchEntryTokenBalance?.();
      setSelectedEntryTokenId(null);
      void loadAvailableEntryTokens();
      setEntryTokenStatus("idle");
    } catch (error) {
      console.error("Failed to obtain entry token", error);
      setEntryTokenStatus("error");
    }
  }, [
    account,
    accountAddress,
    requiresEntryToken,
    configFeeToken,
    configFeeAmount,
    network,
    masterAccount,
    feeAmount,
    feeTokenBalance,
    systemCalls,
    refetchEntryTokenBalance,
    refetchFeeTokenBalance,
    loadAvailableEntryTokens,
  ]);

  // Load tokens on mount and when balance changes
  useEffect(() => {
    void loadAvailableEntryTokens();
  }, [loadAvailableEntryTokens]);

  // Poll for token updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadAvailableEntryTokens();
    }, 7_000);
    return () => clearInterval(intervalId);
  }, [loadAvailableEntryTokens]);

  return {
    entryTokenBalance,
    availableEntryTokenIds,
    selectedEntryTokenId,
    setSelectedEntryTokenId,
    isLoadingEntryTokens,
    entryTokenStatus,
    feeTokenBalance,
    feeAmount,
    feeTokenAddressHex,
    feeTokenSymbol,
    hasSufficientFeeBalance,
    isFeeBalanceLoading,
    requiresEntryToken,
    tokenReady,
    loadAvailableEntryTokens,
    obtainEntryToken,
    refetchEntryTokenBalance,
    refetchFeeTokenBalance,
  };
}
