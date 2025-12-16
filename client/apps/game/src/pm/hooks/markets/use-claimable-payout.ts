import { useMemo } from "react";

import { getContractByName } from "@dojoengine/core";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import { computeRedeemableValue } from "@/pm/hooks/markets/calc-redeemable";
import { formatUnits } from "@/pm/utils";

export const useClaimablePayout = (market: MarketClass, accountAddress?: string) => {
  const {
    config: { manifest },
  } = useDojoSdk();

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);

  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);

  const { balances } = useTokens(
    {
      accountAddresses: accountAddress ? [accountAddress] : undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
      // Avoid tokenId filtering here; Torii token id format (hex vs decimal) can vary and filtering too early hides balances.
      tokenIds: undefined,
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

    return balances.reduce((acc, balance) => {
      const tokenId = BigInt(balance.token_id || 0);
      const idx = positionIds.findIndex((id) => id === tokenId);
      if (idx < 0) return acc;

      const { valueRaw } = computeRedeemableValue({
        market,
        positionIndex: idx,
        balance,
      });
      return acc + valueRaw;
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
