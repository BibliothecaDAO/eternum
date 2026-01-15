import { useMemo, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useClaimablePayout } from "@/pm/hooks/markets/use-claimable-payout";
import { useProtocolFees } from "@/pm/hooks/markets/use-protocol-fees";
import { formatUnits } from "@/pm/utils";
import { getContractByName } from "@dojoengine/core";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

const toUint256 = (val: bigint) => {
  const asUint = uint256.bnToUint256(val);
  return { low: asUint.low, high: asUint.high };
};

export const useMarketRedeem = (market?: MarketClass) => {
  const account = useAccountStore((state) => state.account);
  const { config } = useDojoSdk();
  const [isRedeeming, setIsRedeeming] = useState(false);

  const { claimableAmount, hasRedeemablePositions } = useClaimablePayout(market as MarketClass, account?.address);

  // Vault fees calculation
  const vaultFeesAddress = useMemo(
    () => getContractByName(config.manifest, "pm", "VaultFees")?.address,
    [config.manifest],
  );

  const {
    tokens: { getBalances, balances: allBalances },
  } = useUser();

  const vaultFeeBalances = useMemo(() => {
    if (!vaultFeesAddress) return [];
    return getBalances([vaultFeesAddress]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBalances, getBalances, vaultFeesAddress]);

  const { fees: vaultFees } = useProtocolFees(market?.market_id || "");

  const { vaultFeeBalance, claimableVaultFee } = useMemo(() => {
    if (!market) return { vaultFeeBalance: null, claimableVaultFee: 0n };

    const relatedBalance = vaultFeeBalances.find((t) => BigInt(t.token_id || 0) === BigInt(market.market_id));
    if (!relatedBalance) return { vaultFeeBalance: null, claimableVaultFee: 0n };

    const vaultFeesDenominator = market.vaultFeesDenominator;
    const balance = BigInt(relatedBalance?.balance || 0);
    const denominator = BigInt(vaultFeesDenominator?.value || 1);
    const fees = vaultFees && vaultFees[0] ? BigInt(vaultFees[0].accumulated_fee) : 0n;

    const share = (balance * 10_000n) / denominator;
    const value = (share * fees) / 10_000n;

    return { vaultFeeBalance: relatedBalance, claimableVaultFee: value };
  }, [market, vaultFeeBalances, vaultFees]);

  // Combined claimable amount (position payout + vault fees)
  const totalClaimableAmount = useMemo(() => {
    return claimableAmount + claimableVaultFee;
  }, [claimableAmount, claimableVaultFee]);

  const claimableDisplay = useMemo(() => {
    const decimals = Number(market?.collateralToken?.decimals ?? 18);
    const formatted = formatUnits(totalClaimableAmount, decimals, 4);
    return Number(formatted || 0) > 0 ? formatted : "0";
  }, [totalClaimableAmount, market?.collateralToken?.decimals]);

  const hasClaimableVaultFees = claimableVaultFee > 0n && vaultFeeBalance !== null;

  const redeem = async () => {
    if (!market) return;
    if (!account) {
      toast.error("Connect a wallet to claim.");
      return;
    }

    const marketContractAddress = getContractByName(config.manifest, "pm", "Markets")?.address;
    const conditionalTokensAddress = getContractByName(config.manifest, "pm", "ConditionalTokens")?.address;
    const vaultPositionsAddress = getContractByName(config.manifest, "pm", "VaultPositions")?.address;

    if (!marketContractAddress || !conditionalTokensAddress || !vaultPositionsAddress) {
      toast.error("Missing contract addresses for redeem.");
      return;
    }

    if (!market.isResolved()) {
      toast.error("Claims unlock once the market is resolved.");
      return;
    }

    // Check if user has anything to claim (either positions or vault fees)
    if (!hasRedeemablePositions && !hasClaimableVaultFees) {
      toast.error("No redeemable positions or vault fees detected in your wallet.");
      return;
    }

    try {
      setIsRedeeming(true);

      const calls: Call[] = [];
      const marketIdU256 = toUint256(BigInt(market.market_id));

      // Add position redeem calls if user has redeemable positions
      if (hasRedeemablePositions) {
        const positionIds = market.position_ids;
        if (positionIds && positionIds.length > 0) {
          const parentCollectionId = toUint256(0n);
          const conditionId = toUint256(BigInt(market.condition_id));
          const indexSets = Array.from(
            { length: Number(market.outcome_slot_count) },
            (_value, idx) => 1n << BigInt(idx),
          );
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

          const positionsCalldata = positionIds.flatMap((id) => {
            const asU256 = toUint256(BigInt(id));
            return [asU256.low, asU256.high];
          });
          const redeemCall: Call = {
            contractAddress: marketContractAddress,
            entrypoint: "redeem",
            calldata: [marketIdU256.low, marketIdU256.high, positionIds.length, ...positionsCalldata],
          };

          const approvePositionsCall: Call = {
            contractAddress: vaultPositionsAddress,
            entrypoint: "set_approval_for_all",
            calldata: [marketContractAddress, true],
          };

          calls.push(approvePositionsCall, redeemCall, redeemPositionsCall);
        }
      }

      // Add vault fee claim calls if user has claimable vault fees
      if (hasClaimableVaultFees && vaultFeesAddress) {
        const approveVaultFeesCall: Call = {
          contractAddress: vaultFeesAddress,
          entrypoint: "set_approval_for_all",
          calldata: [marketContractAddress, true],
        };

        const claimVaultFeesCall: Call = {
          contractAddress: marketContractAddress,
          entrypoint: "claim_market_fee_share",
          calldata: [marketIdU256.low, marketIdU256.high],
        };

        calls.push(approveVaultFeesCall, claimVaultFeesCall);
      }

      if (calls.length === 0) {
        toast.error("No claims to process.");
        return;
      }

      await account.execute(calls);
      toast.success("Claim submitted.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit claim transaction.");
    } finally {
      setIsRedeeming(false);
    }
  };

  // User can claim if they have either redeemable positions or vault fees
  const hasAnythingToClaim = hasRedeemablePositions || hasClaimableVaultFees;

  return {
    redeem,
    isRedeeming,
    claimableDisplay,
    hasRedeemablePositions,
    hasClaimableVaultFees,
    hasAnythingToClaim,
  };
};
