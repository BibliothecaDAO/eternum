import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useProtocolFees } from "@/pm/hooks/markets/use-protocol-fees";
import { getPmSqlApiForUrl } from "@/pm/hooks/queries";
import { HStack, VStack } from "@/pm/ui";
import { formatUnits } from "@/pm/utils";
import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";
import { Button } from "@/ui/design-system/atoms";
import { getContractByName } from "@dojoengine/core";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addAddressPadding, Call, uint256 } from "starknet";
import { TokenIcon } from "../token-icon";

type MarketDataChain = "slot" | "mainnet";

export function MarketVaultFees({
  market,
  chain,
  address: providedAddress,
}: {
  market: MarketClass;
  chain: MarketDataChain;
  address?: string;
}) {
  const {
    config: { manifest },
  } = useDojoSdk();

  const { account, address: connectedAddress } = useAccount();
  const address = providedAddress ?? connectedAddress ?? account?.address;

  const marketAddress = getContractByName(manifest, "pm", "Markets")!.address;
  const vaultFeesAdress = getContractByName(manifest, "pm", "VaultFees").address;

  const {
    tokens: { getBalances },
  } = useUser();

  const balances = useMemo(() => {
    return getBalances([vaultFeesAdress]);
  }, [getBalances, vaultFeesAdress]);

  // todo : implement this
  const { fees: vaultFees } = useProtocolFees(market.market_id);
  const { data: addressProtocolFees } = useQuery({
    queryKey: ["pm", "protocol-fees", "address", chain, address],
    enabled: Boolean(address),
    queryFn: async () => {
      if (!address) return null;
      const paddedAddress = addAddressPadding(address.toLowerCase());
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchProtocolFeesById(paddedAddress);
    },
    staleTime: 30 * 1000,
  });

  const { relatedBalance, hasVaultShares, share, shareDisplay, value } = useMemo(() => {
    const relatedBalance = balances.find((t) => BigInt(t.token_id || 0) === BigInt(market.market_id));

    const vaultFeesDenominator = market.vaultFeesDenominator;

    const balance = BigInt(relatedBalance?.balance || 0);
    const denominator = BigInt(vaultFeesDenominator?.value || 1);
    const hasVaultShares = balance > 0n;
    const marketFees = vaultFees && vaultFees[0] ? BigInt(vaultFees[0].accumulated_fee) : 0n;
    const userAccumulated = BigInt(addressProtocolFees?.accumulated_fee || 0);
    const userClaimed = BigInt(addressProtocolFees?.claimed_fee || 0);
    const userClaimable = userAccumulated > userClaimed ? userAccumulated - userClaimed : 0n;

    const share = hasVaultShares ? (balance * 10_000n) / denominator : 0n;
    const value = hasVaultShares ? (share * marketFees) / 10_000n : userClaimable;
    const sharePercent = Number(share) / 100;
    const shareDisplay =
      hasVaultShares && Number.isFinite(sharePercent)
        ? sharePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : "--";

    return {
      relatedBalance,
      hasVaultShares,
      share,
      shareDisplay,
      value,
    };
  }, [addressProtocolFees, balances, market, vaultFees]);

  const decimals = Number(market.collateralToken.decimals);
  // Change: The vault balance is a number of shares, not a token amount.
  // No decimals handling/formatUnits, just show the raw shares amount.
  const sharesDisplay = useMemo(() => {
    if (!relatedBalance) return "--";
    return formatUnits(relatedBalance.balance, decimals, 4);
  }, [relatedBalance, decimals]);
  const redeemableDisplay = useMemo(() => formatUnits(value, decimals, 6), [value, decimals]);

  const canClaim = market.isResolved() && value > 0n;
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

  if (!hasVaultShares && value === 0n) {
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
                {shareDisplay === "--" ? "--" : Number(share) > 0 ? `${formatUnits(share, 2, 2)}%` : "0%"}
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
