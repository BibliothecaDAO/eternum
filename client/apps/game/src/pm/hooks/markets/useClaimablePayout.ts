import { useMemo } from "react";

import { getContractByName } from "@dojoengine/core";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useTokens } from "@/pm/hooks/dojo/useTokens";
import { formatUnits } from "@/pm/utils";

export const useClaimablePayout = (market: MarketClass, accountAddress?: string) => {
  const {
    config: { manifest },
  } = useDojoSdk();

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);

  const vaultPositionsAddress = useMemo(
    () => getContractByName(manifest, "pm", "VaultPositions")?.address,
    [manifest],
  );

  const positionIdsAsStrings = useMemo(() => positionIds.map((id) => id.toString()), [positionIds]);

  const { balances } = useTokens(
    {
      accountAddresses: accountAddress ? [accountAddress] : undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
      tokenIds: positionIdsAsStrings,
    },
    true,
  );

  const hasRedeemablePositions = useMemo(() => {
    if (!accountAddress) return false;
    return balances.some(
      (balance) =>
        BigInt(balance.balance || 0) > 0n &&
        positionIds.some((id) => BigInt(balance.token_id || 0) === id) &&
        BigInt(balance.account_address) === BigInt(accountAddress || 0),
    );
  }, [accountAddress, balances, positionIds]);

  const claimableAmount = useMemo(() => {
    if (!market.isResolved()) return 0n;
    const payouts = market.conditionResolution?.payout_numerators;
    if (!payouts || payouts.length === 0) return 0n;
    const totalPayout = payouts.reduce((acc, v) => acc + BigInt(v), 0n);
    if (totalPayout === 0n) return 0n;

    const denominator = BigInt(market.vaultDenominator?.value || 0);
    if (denominator === 0n) return 0n;

    return balances.reduce((acc, balance) => {
      const tokenId = BigInt(balance.token_id || 0);
      const idx = positionIds.findIndex((id) => id === tokenId);
      if (idx < 0) return acc;

      const outcomeNumerator = BigInt(market.vaultNumerators?.find((n) => Number(n.index) === idx)?.value || 0);
      if (outcomeNumerator === 0n) return acc;

      const payout = BigInt(payouts[idx] ?? 0);
      if (payout === 0n) return acc;

      const share = (payout * 10_000n) / totalPayout;
      const rewardPerUnit = (share * denominator) / outcomeNumerator;
      const payoutAmount = (rewardPerUnit * BigInt(balance.balance || 0)) / 10_000n;
      return acc + payoutAmount;
    }, 0n);
  }, [balances, market, positionIds]);

  const claimableDisplay = useMemo(() => {
    const decimals = Number(market.collateralToken?.decimals ?? 18);
    const formatted = formatUnits(claimableAmount, decimals, 4);
    return Number(formatted || 0) > 0 ? formatted : "0";
  }, [claimableAmount, market.collateralToken?.decimals]);

  return {
    claimableAmount,
    claimableDisplay,
    hasRedeemablePositions,
  };
};
