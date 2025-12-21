import { useStore } from "@/shared/store";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useClaimablePayout } from "@/pm/hooks/markets/use-claimable-payout";
import { getContractByName } from "@dojoengine/core";
import { useState } from "react";
import { Call, uint256 } from "starknet";

const toUint256 = (value: bigint) => {
  const asUint = uint256.bnToUint256(value);
  return { low: asUint.low, high: asUint.high };
};

export const useMarketRedeem = (market?: MarketClass) => {
  const account = useStore((state) => state.account);
  const { config } = useDojoSdk();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { claimableDisplay, hasRedeemablePositions } = useClaimablePayout(market as MarketClass, account?.address);

  const redeem = async () => {
    if (!market) return;
    setError(null);

    if (!account) {
      setError("Connect a wallet to claim.");
      return;
    }

    const marketContractAddress = getContractByName(config.manifest, "pm", "Markets")?.address;
    const conditionalTokensAddress = getContractByName(config.manifest, "pm", "ConditionalTokens")?.address;
    const vaultPositionsAddress = getContractByName(config.manifest, "pm", "VaultPositions")?.address;

    if (!marketContractAddress || !conditionalTokensAddress || !vaultPositionsAddress) {
      setError("Missing contract addresses for redeem.");
      return;
    }

    if (!market.isResolved()) {
      setError("Claims unlock once the market is resolved.");
      return;
    }

    if (!hasRedeemablePositions) {
      setError("No redeemable positions detected in your wallet.");
      return;
    }

    const positionIds = market.position_ids;
    if (!positionIds || positionIds.length === 0) {
      setError("No position IDs found for this market.");
      return;
    }

    try {
      setIsRedeeming(true);

      const parentCollectionId = toUint256(0n);
      const conditionId = toUint256(BigInt(market.condition_id));
      const indexSets = Array.from({ length: Number(market.outcome_slot_count) }, (_value, idx) => 1n << BigInt(idx));
      const indexSetsCalldata = indexSets.flatMap((indexSet) => {
        const asU256 = toUint256(indexSet);
        return [asU256.low, asU256.high];
      });

      const redeemPositionsCall: Call = {
        contractAddress: conditionalTokensAddress,
        entrypoint: "redeem_positions",
        calldata: [
          market.collateral_token,
          parentCollectionId.low,
          parentCollectionId.high,
          conditionId.low,
          conditionId.high,
          indexSets.length,
          ...indexSetsCalldata,
        ],
      };

      const marketIdU256 = toUint256(BigInt(market.market_id));
      const positionsCalldata = positionIds.flatMap((id) => {
        const asU256 = toUint256(BigInt(id));
        return [asU256.low, asU256.high];
      });
      const redeemCall: Call = {
        contractAddress: marketContractAddress,
        entrypoint: "redeem",
        calldata: [marketIdU256.low, marketIdU256.high, positionIds.length, ...positionsCalldata],
      };

      const approveCall: Call = {
        contractAddress: vaultPositionsAddress,
        entrypoint: "set_approval_for_all",
        calldata: [marketContractAddress, true],
      };

      await account.execute([approveCall, redeemCall, redeemPositionsCall]);
    } catch (caughtError) {
      console.error(caughtError);
      setError("Failed to submit redeem transaction.");
    } finally {
      setIsRedeeming(false);
    }
  };

  return {
    redeem,
    isRedeeming,
    claimableDisplay,
    hasRedeemablePositions,
    error,
  };
};
