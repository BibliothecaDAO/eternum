import { useEffect, useMemo } from "react";

import { getContractByName } from "@dojoengine/core";
import { addAddressPadding } from "starknet";
import { useQuery } from "@tanstack/react-query";

import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";
import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import { computeRedeemableValue } from "@/pm/hooks/markets/calc-redeemable";
import { getPmSqlApiForUrl } from "@/pm/hooks/queries";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { formatUnits } from "@/pm/utils";

type MarketDataChain = "slot" | "mainnet";
const PM_DEBUG_GLOBAL_FLAG = "__PM_DEBUG_REDEEMABLE__";

function isPmDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const flagValue = (window as unknown as Record<string, unknown>)[PM_DEBUG_GLOBAL_FLAG];
  return flagValue === true;
}

export const useClaimablePayout = (market: MarketClass, accountAddress?: string, chainOverride?: MarketDataChain) => {
  const {
    config: { manifest },
  } = useDojoSdk();
  const chain = chainOverride ?? getPredictionMarketChain();

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);
  const accountAddressFilters = useMemo(() => {
    if (!accountAddress) return undefined;
    const variants = new Set<string>();
    variants.add(accountAddress);
    try {
      variants.add(`0x${BigInt(accountAddress).toString(16)}`);
    } catch {
      // Ignore invalid variant derivation and keep the original address.
    }
    try {
      variants.add(addAddressPadding(accountAddress.toLowerCase()));
    } catch {
      // Ignore invalid padding conversion and keep available variants.
    }
    return Array.from(variants);
  }, [accountAddress]);

  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);
  const hasPayoutNumerators = Boolean(market.conditionResolution?.payout_numerators?.length);
  const conditionIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.condition_id || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.condition_id]);
  const oracleHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.oracle || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.oracle]);
  const questionIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.question_id || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.question_id]);
  const marketIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.market_id || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.market_id]);
  const paddedAccountAddress = useMemo(() => {
    if (!accountAddress) return null;
    try {
      return addAddressPadding(`0x${BigInt(accountAddress).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [accountAddress]);

  const { data: conditionResolutionRow } = useQuery({
    queryKey: ["pm", "condition-resolution", chain, conditionIdHex, oracleHex, questionIdHex],
    enabled: Boolean(market.isResolved() && !hasPayoutNumerators && conditionIdHex && oracleHex && questionIdHex),
    queryFn: async () => {
      if (!conditionIdHex || !oracleHex || !questionIdHex) return null;
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchConditionResolutionByKeys(
        conditionIdHex,
        oracleHex,
        questionIdHex,
      );
    },
    staleTime: 30 * 1000,
  });

  const payoutNumerators = useMemo<Array<bigint> | undefined>(() => {
    const marketPayouts = market.conditionResolution?.payout_numerators;
    if (marketPayouts && marketPayouts.length > 0) {
      return marketPayouts.map((value) => BigInt(value));
    }

    if (!conditionResolutionRow?.payout_numerators) return undefined;
    try {
      const parsed = JSON.parse(conditionResolutionRow.payout_numerators);
      if (!Array.isArray(parsed)) return undefined;
      return parsed.map((value) => BigInt(value as string | number));
    } catch {
      return undefined;
    }
  }, [conditionResolutionRow?.payout_numerators, market.conditionResolution?.payout_numerators]);
  const { data: userBuyRows = [] } = useQuery({
    queryKey: ["pm", "claimable-payout", "market-buys", chain, marketIdHex, paddedAccountAddress],
    enabled: Boolean(marketIdHex && paddedAccountAddress),
    queryFn: async () => {
      if (!marketIdHex || !paddedAccountAddress) return [];
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchMarketBuyOutcomesByMarketAndAccount(
        marketIdHex,
        paddedAccountAddress,
      );
    },
    staleTime: 30 * 1000,
  });

  const { balances } = useTokens(
    {
      accountAddresses: accountAddressFilters,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
      // Avoid tokenId filtering here; Torii token id format (hex vs decimal) can vary and filtering too early hides balances.
      tokenIds: undefined,
    },
    true,
  );

  const hasRedeemableFromBalances = useMemo(() => {
    if (!accountAddress) return false;
    return balances.some(
      (balance) =>
        BigInt(balance.balance || 0) > 0n &&
        positionIds.some((id) => BigInt(balance.token_id || 0) === id) &&
        BigInt(balance.account_address) === BigInt(accountAddress || 0),
    );
  }, [accountAddress, balances, positionIds]);

  const claimableAmountFromBalances = useMemo(() => {
    if (!market.isResolved()) return 0n;

    return balances.reduce((acc, balance) => {
      const tokenId = BigInt(balance.token_id || 0);
      const idx = positionIds.findIndex((id) => id === tokenId);
      if (idx < 0) return acc;

      const { valueRaw } = computeRedeemableValue({
        market,
        positionIndex: idx,
        balance,
        payoutNumerators,
      });
      return acc + valueRaw;
    }, 0n);
  }, [balances, market, payoutNumerators, positionIds]);
  const claimableAmountFromBuys = useMemo(() => {
    if (!market.isResolved()) return 0n;
    if (userBuyRows.length === 0) return 0n;

    return userBuyRows.reduce((sum, row) => {
      const outcomeIndex = Number(row.outcome_index ?? 0);
      if (!Number.isFinite(outcomeIndex) || outcomeIndex < 0) return sum;

      let amountRaw: bigint;
      try {
        amountRaw = BigInt(row.amount ?? 0);
      } catch {
        amountRaw = 0n;
      }
      if (amountRaw === 0n) return sum;

      const syntheticBalance = {
        account_address: paddedAccountAddress ?? "0x0",
        contract_address: vaultPositionsAddress ?? "0x0",
        token_id: positionIds[outcomeIndex]?.toString() ?? "0",
        balance: amountRaw.toString(),
      } as unknown as Parameters<typeof computeRedeemableValue>[0]["balance"];

      const { valueRaw } = computeRedeemableValue({
        market,
        positionIndex: outcomeIndex,
        balance: syntheticBalance,
        payoutNumerators,
      });
      return sum + valueRaw;
    }, 0n);
  }, [market, paddedAccountAddress, payoutNumerators, positionIds, userBuyRows, vaultPositionsAddress]);

  const claimableAmount = useMemo(() => {
    return claimableAmountFromBalances > 0n ? claimableAmountFromBalances : claimableAmountFromBuys;
  }, [claimableAmountFromBalances, claimableAmountFromBuys]);
  const hasRedeemablePositions = useMemo(() => {
    return hasRedeemableFromBalances || claimableAmountFromBuys > 0n;
  }, [hasRedeemableFromBalances, claimableAmountFromBuys]);

  const claimableDisplay = useMemo(() => {
    const decimals = Number(market.collateralToken?.decimals ?? 18);
    const formatted = formatUnits(claimableAmount, decimals, 4);
    return Number(formatted || 0) > 0 ? formatted : "0";
  }, [claimableAmount, market.collateralToken?.decimals]);

  useEffect(() => {
    if (!isPmDebugEnabled()) return;

    const matchedBalances = balances
      .filter((balance) => positionIds.some((id) => BigInt(balance.token_id || 0) === id))
      .map((balance) => ({
        account_address: balance.account_address,
        token_id: balance.token_id,
        balance: balance.balance,
      }));

    console.log("[PM_DEBUG][useClaimablePayout]", {
      chain,
      accountAddress,
      marketId: market.market_id?.toString?.() ?? String(market.market_id),
      conditionIdHex,
      oracleHex,
      questionIdHex,
      hasMarketConditionResolution: Boolean(market.conditionResolution?.payout_numerators?.length),
      payoutNumerators: payoutNumerators?.map((value) => value.toString()) ?? null,
      matchedBalances,
      userBuyRowsCount: userBuyRows.length,
      claimableAmountFromBalancesRaw: claimableAmountFromBalances.toString(),
      claimableAmountFromBuysRaw: claimableAmountFromBuys.toString(),
      claimableAmountRaw: claimableAmount.toString(),
      claimableDisplay,
      hasRedeemablePositions,
    });
  }, [
    accountAddress,
    chain,
    claimableAmount,
    claimableDisplay,
    conditionIdHex,
    hasRedeemablePositions,
    market.conditionResolution?.payout_numerators,
    market.market_id,
    oracleHex,
    paddedAccountAddress,
    payoutNumerators,
    positionIds,
    questionIdHex,
    userBuyRows.length,
    claimableAmountFromBalances,
    claimableAmountFromBuys,
    balances,
  ]);

  return {
    claimableAmount,
    claimableDisplay,
    hasRedeemablePositions,
  };
};
