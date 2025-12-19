import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useProtocolFees } from "@/pm/hooks/markets/use-protocol-fees";
import { HStack, VStack } from "@/pm/ui";
import { formatUnits } from "@/pm/utils";
import { Button } from "@/ui/design-system/atoms";
import { getContractByName } from "@dojoengine/core";
import { useAccount } from "@starknet-react/core";
import { ArrowDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";
import { TokenIcon } from "../token-icon";

export function MarketVaultFees({ market }: { market: MarketClass }) {
  const {
    config: { manifest },
  } = useDojoSdk();

  const { account } = useAccount();

  const marketAddress = getContractByName(manifest, "pm", "Markets")!.address;
  const vaultFeesAdress = getContractByName(manifest, "pm", "VaultFees").address;

  const {
    tokens: { getBalances, balances: allBalances },
  } = useUser();

  const balances = useMemo(() => {
    return getBalances([vaultFeesAdress]);
  }, [allBalances, getBalances, vaultFeesAdress]);

  // todo : implement this
  const { fees: vaultFees } = useProtocolFees(market.market_id);

  const { relatedBalance, share, shareDisplay, value } = useMemo(() => {
    const relatedBalance = balances.find((t) => BigInt(t.token_id || 0) === BigInt(market.market_id));

    const vaultFeesDenominator = market.vaultFeesDenominator;

    const balance = BigInt(relatedBalance?.balance || 0);
    const denominator = BigInt(vaultFeesDenominator?.value || 1);
    const fees = vaultFees && vaultFees[0] ? BigInt(vaultFees[0].accumulated_fee) : 0n;

    const share = (balance * 10_000n) / denominator;
    const value = (share * fees) / 10_000n;
    const sharePercent = Number(share) / 100;
    const shareDisplay = Number.isFinite(sharePercent)
      ? sharePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "0";

    return {
      relatedBalance,
      share,
      shareDisplay,
      value,
    };
  }, [balances, market, market.vaultFeesDenominator?.value, vaultFees]);

  // Change: The vault balance is a number of shares, not a token amount.
  // No decimals handling/formatUnits, just show the raw shares amount.
  const sharesDisplay = useMemo(() => {
    if (!relatedBalance) return "0";
    return BigInt(relatedBalance.balance).toLocaleString();
  }, [relatedBalance]);

  const decimals = Number(market.collateralToken.decimals);
  const redeemableDisplay = useMemo(() => formatUnits(value, decimals, 6), [value, decimals]);

  const canClaim = market.isResolved();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: multicall with redeem tokens
  const claim = async () => {
    if (!account) {
      toast.error("Connect a wallet to claim fees.");
      return;
    }
    if (!canClaim) {
      toast.error("You can only claim after the market is resolved.");
      return;
    }

    const approveCall: Call = {
      contractAddress: vaultFeesAdress,
      entrypoint: "set_approval_for_all",
      calldata: [marketAddress, true],
    };

    // Use uint256 for market id as calldata
    const marketId_u256 = uint256.bnToUint256(BigInt(market.market_id));
    const claimCall: Call = {
      contractAddress: marketAddress,
      entrypoint: "claim_market_fee_share",
      calldata: [marketId_u256.low, marketId_u256.high],
    };

    try {
      setIsSubmitting(true);
      const resultTx = await account.execute([approveCall, claimCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(resultTx.transaction_hash);
      }

      toast.success("Vault Fees claimed!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to claim vault fees.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!relatedBalance) {
    return (
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/80">
        <p className="text-white">Vault fees</p>
        <p className="mt-1 text-xs text-gold/60">You don't have any vault fee shares for this market.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold/80">
          Vault fees
        </div>
        <Button variant="secondary" size="xs" className="gap-2" onClick={claim} disabled={!canClaim || isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
          {isSubmitting ? "Claiming..." : "Claim"}
        </Button>
      </div>

      {!canClaim && <div className="mb-4 text-xs text-gold/60">Claims unlock once the market is resolved.</div>}

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <VStack className="gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Your share</span>
              <span className="text-lg font-semibold text-white">
                {Number(share) > 0 ? `${formatUnits(share, 2, 2)}%` : "0%"}
              </span>
              <span className="text-xs text-gold/60">of accumulated fees</span>
            </VStack>

            <VStack className="gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Vault shares</span>
              <HStack className="items-baseline gap-1">
                <span className="text-lg font-semibold text-white">{sharesDisplay}</span>
              </HStack>
              <span className="text-xs text-gold/60">vault shares held</span>
            </VStack>

            <VStack className="gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Redeemable</span>
              <HStack className="items-baseline gap-1">
                <span className="text-lg font-semibold text-white">{Number(value) > 0 ? redeemableDisplay : "0"}</span>
                <TokenIcon token={market.collateralToken} size={16} />
              </HStack>
              <span className="text-xs text-gold/60">claimable right now</span>
            </VStack>
          </div>
        </div>
      </div>
    </>
  );
}
