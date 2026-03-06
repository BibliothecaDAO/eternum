import { useMemo, useState } from "react";

import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useClaimablePayout } from "@/pm/hooks/markets/use-claimable-payout";
import { useProtocolFees } from "@/pm/hooks/markets/use-protocol-fees";
import { getPmSqlApiForUrl } from "@/pm/hooks/queries";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { formatUnits } from "@/pm/utils";
import { getContractByName } from "@dojoengine/core";
import { useAccount } from "@starknet-react/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addAddressPadding, Call, uint256 } from "starknet";

type MarketDataChain = "slot" | "mainnet";
const CLAIM_TX_TIMEOUT_MS = 120_000;
const CLAIM_CONFIRM_TIMEOUT_MS = 45_000;

const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
};

const waitForClaimConfirmation = async (
  account: {
    waitForTransaction?: (txHash: string) => Promise<unknown>;
    provider?: {
      waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
      waitForTransaction?: (txHash: string) => Promise<unknown>;
    };
  },
  txHash: string,
) => {
  const waitWithCheck =
    account.provider && typeof account.provider.waitForTransactionWithCheck === "function"
      ? account.provider.waitForTransactionWithCheck.bind(account.provider)
      : null;
  const waitFromAccount =
    typeof account.waitForTransaction === "function" ? account.waitForTransaction.bind(account) : null;
  const waitFromProvider =
    account.provider && typeof account.provider.waitForTransaction === "function"
      ? account.provider.waitForTransaction.bind(account.provider)
      : null;

  const waitFn = waitWithCheck ?? waitFromAccount ?? waitFromProvider;
  if (!waitFn) return false;

  await withTimeout(waitFn(txHash), "Claim transaction confirmation", CLAIM_CONFIRM_TIMEOUT_MS);
  return true;
};

const toUint256 = (val: bigint) => {
  const asUint = uint256.bnToUint256(val);
  return { low: asUint.low, high: asUint.high };
};

export const useMarketRedeem = (market?: MarketClass, chainOverride?: MarketDataChain) => {
  const storeAccount = useAccountStore((state) => state.account);
  const { account: connectedAccount, address: connectedAddress } = useAccount();
  const account = storeAccount ?? connectedAccount ?? null;
  const accountAddress = account?.address ?? connectedAddress;
  const chain = chainOverride ?? getPredictionMarketChain();
  const { config } = useDojoSdk();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [suppressClaimUi, setSuppressClaimUi] = useState(false);
  const queryClient = useQueryClient();

  const { claimableAmount, hasRedeemablePositions } = useClaimablePayout(market, accountAddress, chainOverride);

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

  const marketIdForProtocolFees = useMemo(() => {
    if (market?.market_id == null) return 0n;
    try {
      return BigInt(market.market_id);
    } catch {
      return 0n;
    }
  }, [market?.market_id]);

  const { fees: vaultFees } = useProtocolFees(marketIdForProtocolFees.toString());

  const { data: addressProtocolFees } = useQuery({
    queryKey: ["pm", "protocol-fees", "address", chain, accountAddress],
    enabled: Boolean(accountAddress),
    queryFn: async () => {
      if (!accountAddress) return null;

      let normalizedAddress = accountAddress.toLowerCase();
      try {
        normalizedAddress = addAddressPadding(`0x${BigInt(accountAddress).toString(16)}`).toLowerCase();
      } catch {
        // Keep lowercase fallback when address normalization fails.
      }

      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchProtocolFeesById(normalizedAddress);
    },
    staleTime: 30 * 1000,
  });

  const { claimableMarketFeeShare, claimableAddressFee } = useMemo(() => {
    if (!market) return { claimableMarketFeeShare: 0n, claimableAddressFee: 0n };

    const userAccumulated = BigInt(addressProtocolFees?.accumulated_fee || 0);
    const userClaimed = BigInt(addressProtocolFees?.claimed_fee || 0);
    const claimableAddressFee = userAccumulated > userClaimed ? userAccumulated - userClaimed : 0n;

    const relatedBalance = vaultFeeBalances.find((t) => BigInt(t.token_id || 0) === BigInt(market.market_id));
    if (!relatedBalance) return { claimableMarketFeeShare: 0n, claimableAddressFee };

    const vaultFeesDenominator = market.vaultFeesDenominator;
    const balance = BigInt(relatedBalance?.balance || 0);
    const denominator = BigInt(vaultFeesDenominator?.value || 1);
    const fees = vaultFees && vaultFees[0] ? BigInt(vaultFees[0].accumulated_fee) : 0n;

    const share = denominator > 0n ? (balance * 10_000n) / denominator : 0n;
    const claimableMarketFeeShare = (share * fees) / 10_000n;

    return { claimableMarketFeeShare, claimableAddressFee };
  }, [market, vaultFeeBalances, vaultFees, addressProtocolFees]);

  // Combined claimable amount (position payout + vault fees)
  const totalClaimableAmount = useMemo(() => {
    return claimableAmount + claimableMarketFeeShare + claimableAddressFee;
  }, [claimableAmount, claimableMarketFeeShare, claimableAddressFee]);

  const claimableDisplay = useMemo(() => {
    const decimals = Number(market?.collateralToken?.decimals ?? 18);
    const formatted = formatUnits(totalClaimableAmount, decimals, 4);
    return Number(formatted || 0) > 0 ? formatted : "0";
  }, [totalClaimableAmount, market?.collateralToken?.decimals]);

  const hasClaimableVaultFees = claimableMarketFeeShare > 0n;
  const hasClaimableAddressFees = claimableAddressFee > 0n;
  const canAttemptPositionRedeem = Boolean(market?.isResolved() && accountAddress);

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

    try {
      setIsRedeeming(true);

      const calls: Call[] = [];
      const marketIdU256 = toUint256(BigInt(market.market_id));

      // Only include position redeem calls when we detect redeemable positions.
      // Fallback to force position redeem only when there are no fee claims to process,
      // otherwise "Nothing to redeem" reverts can block fee-only claims.
      const shouldIncludePositionRedeem =
        hasRedeemablePositions || (canAttemptPositionRedeem && !hasClaimableVaultFees && !hasClaimableAddressFees);

      if (shouldIncludePositionRedeem) {
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

      if (hasClaimableAddressFees) {
        const claimAddressFeesCall: Call = {
          contractAddress: marketContractAddress,
          entrypoint: "claim_address_fee",
          calldata: [1, market.collateral_token],
        };

        calls.push(claimAddressFeesCall);
      }

      if (calls.length === 0) {
        toast.error("No claims to process.");
        return;
      }

      const tx = await withTimeout(account.execute(calls), "Claim transaction submission", CLAIM_TX_TIMEOUT_MS);
      const txHash =
        typeof tx === "object" &&
        tx !== null &&
        "transaction_hash" in tx &&
        typeof (tx as { transaction_hash?: unknown }).transaction_hash === "string"
          ? ((tx as { transaction_hash: string }).transaction_hash as string)
          : null;

      if (txHash) {
        try {
          const confirmed = await waitForClaimConfirmation(
            account as {
              waitForTransaction?: (txHash: string) => Promise<unknown>;
              provider?: {
                waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
                waitForTransaction?: (txHash: string) => Promise<unknown>;
              };
            },
            txHash,
          );
          toast.success(confirmed ? "Claim confirmed." : "Claim submitted.");
        } catch (confirmError) {
          toast.success("Claim submitted. Confirmation is delayed; refresh shortly.");
        }
      } else {
        toast.success("Claim submitted.");
      }

      // Hide stale claim CTA immediately after a successful claim submit/confirm
      // while indexers catch up, then force data refresh through query invalidation.
      setSuppressClaimUi(true);
      setTimeout(() => setSuppressClaimUi(false), 20_000);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["pm", "claimable-payout"] }),
        queryClient.invalidateQueries({ queryKey: ["pm", "protocol-fees"] }),
        queryClient.invalidateQueries({ queryKey: ["pm", "market"] }),
      ]);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (message.includes("nothing to redeem") || message.includes("nothin to redeem")) {
        setSuppressClaimUi(true);
        setTimeout(() => setSuppressClaimUi(false), 5 * 60_000);
      }
      toast.error(error instanceof Error ? error.message : "Failed to submit claim transaction.");
    } finally {
      setIsRedeeming(false);
    }
  };

  // UI gating should only expose claim actions when we have concrete claimable signal,
  // otherwise users can hit "Nothing to redeem" after already claiming.
  const hasAnythingToClaimBase = hasRedeemablePositions || hasClaimableVaultFees || hasClaimableAddressFees;
  const hasAnythingToClaim = hasAnythingToClaimBase && !suppressClaimUi;
  const displayClaimable = suppressClaimUi ? "0" : claimableDisplay;

  return {
    redeem,
    isRedeeming,
    claimableDisplay: displayClaimable,
    hasRedeemablePositions,
    hasClaimableVaultFees,
    hasClaimableAddressFees,
    hasAnythingToClaim,
  };
};
