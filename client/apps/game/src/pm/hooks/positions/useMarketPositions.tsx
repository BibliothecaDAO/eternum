import { getContractByName } from "@dojoengine/core";
import { Token, TokenBalance } from "@dojoengine/torii-wasm";
import { useMemo } from "react";
import { RegisteredToken } from "../../bindings";
import { MarketClass, MarketOutcome } from "../../class";
import { formatUnits } from "../../utils";
import { useDojoSdk } from "../dojo/useDojoSdk";
import { useUser } from "../dojo/user";

export type MarketPositionDetails = {
  token: Token;
  balance: TokenBalance;
  collateralToken: RegisteredToken;
  balanceFormatted: string;
  valueFormatted: string;
  outcome: MarketOutcome;
};

export const useMarketPositions = ({ market }: { market: MarketClass }) => {
  const {
    config: { manifest },
  } = useDojoSdk();

  const vaultPositionsAdress = getContractByName(manifest, "pm", "VaultPositions").address;
  const vaultFeesAddress = getContractByName(manifest, "pm", "VaultFees").address;

  const {
    tokens: { getTokens, getBalances },
  } = useUser();

  const tokens = getTokens([vaultPositionsAdress, vaultFeesAddress]);
  const balances = getBalances([vaultPositionsAdress, vaultFeesAddress]);

  const { relatedTokens, relatedBalances } = useMemo(() => {
    const relatedTokens = tokens.filter(
      (t) =>
        (market.position_ids || []).map((i) => BigInt(i)).includes(BigInt(t.token_id || 0)) ||
        BigInt(market.market_id) === BigInt(t.token_id || 0),
    );

    const relatedBalances = balances.filter(
      (t) =>
        BigInt(t.balance) > 0 &&
        ((market.position_ids || []).map((i) => BigInt(i)).includes(BigInt(t.token_id || 0)) ||
          BigInt(market.market_id) === BigInt(t.token_id || 0)),
    );

    return {
      relatedTokens,
      relatedBalances,
    };
  }, [tokens, balances, market]);

  const outcomes = useMemo(() => {
    return market.getMarketOutcomes();
  }, [market]);

  const allPositions = useMemo(() => {
    if (!market) return [];
    if (!relatedTokens || relatedTokens.length === 0) return [];
    if (!relatedBalances || relatedBalances.length === 0) return [];
    if (!outcomes || outcomes.length === 0) return [];

    return relatedBalances.flatMap((balance) => {
      const token = relatedTokens.find(
        (t) =>
          BigInt(t.contract_address) === BigInt(balance.contract_address) &&
          BigInt(t.token_id || 0) === BigInt(balance.token_id || 0),
      );

      if (!token) return [];

      const index = market.position_ids.map((i) => BigInt(i)).indexOf(BigInt(token.token_id || 0));
      const isVaultFeeToken = BigInt(token.contract_address) === BigInt(vaultFeesAddress);

      // fee share position & not a market.position_ids
      if (index < 0 && !isVaultFeeToken) return [];
      if (!isVaultFeeToken && !outcomes[index]) return [];

      let value = "0";
      if (!isVaultFeeToken && market.isResolved()) {
        const payouts = market.conditionResolution!.payout_numerators.map((i) => Number(i));
        const totalPayout = payouts.reduce((p, c) => p + c, 0);
        const payout = payouts ? payouts[index] : 0;
        const totalShare = BigInt((payout * 10_000) / totalPayout);

        if (payout > 0) {
          const denominator = BigInt(market.vaultDenominator!.value);
          const numerator = BigInt(market.vaultNumerators?.find((i) => i.index === index)?.value || 0);
          const share = (totalShare * denominator) / numerator;

          value = formatUnits((share * BigInt(balance.balance)) / 10_000n, Number(market.collateralToken.decimals), 4);
        }
      }

      // if (BigInt(token.contract_address) === BigInt(vaultFeesAddress)) {
      // }

      return [
        {
          token,
          balance,
          collateralToken: market.collateralToken,
          balanceFormatted: formatUnits(BigInt(balance.balance), Number(market.collateralToken.decimals), 4),
          valueFormatted: value,
          outcome: isVaultFeeToken
            ? {
                index: -1,
                name: "Vault fees",
                label: "Vault fees",
                odds: "0",
                gain: 0,
              }
            : outcomes[index],
        },
      ];
    });
  }, [market, relatedBalances, relatedTokens, outcomes, vaultFeesAddress]);

  const { positions, vaultFeesPositions } = useMemo(() => {
    return {
      positions: allPositions.filter((i) => BigInt(i.balance.contract_address) === BigInt(vaultPositionsAdress)),
      vaultFeesPositions: allPositions.filter((i) => BigInt(i.balance.contract_address) === BigInt(vaultFeesAddress)),
    };
  }, [allPositions, vaultFeesAddress, vaultPositionsAdress]);

  return {
    positions,
    vaultFeesPositions,
  };
};
