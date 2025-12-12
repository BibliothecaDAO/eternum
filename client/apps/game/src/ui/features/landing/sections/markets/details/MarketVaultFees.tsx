import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useProtocolFees } from "@/pm/hooks/markets/useProtocolFees";
import { HStack, VStack } from "@/pm/ui";
import { formatUnits } from "@/pm/utils";
import { Button } from "@/ui/design-system/atoms";
import { getContractByName } from "@dojoengine/core";
import { useAccount } from "@starknet-react/core";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";
import { TokenIcon } from "../TokenIcon";

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

  const decimals = Number(market.collateralToken.decimals);
  const balanceDisplay = useMemo(() => {
    if (!relatedBalance) return "0.0000";
    return formatUnits(relatedBalance.balance, decimals, 4);
  }, [relatedBalance, decimals]);

  const redeemableDisplay = useMemo(() => formatUnits(value, decimals, 6), [value, decimals]);

  const canClaim = market.isResolved();

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

    await account?.execute([approveCall, claimCall]).then(() => toast("Vault Fees claimed!"));
  };

  if (!relatedBalance) return null;
  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner text-white">
      <HStack className="items-start justify-between gap-3">
        <VStack className="gap-1">
          <div className="text-xs uppercase tracking-[0.08em] text-gold/70">Vault fees</div>
          <div className="text-lg font-semibold text-white">Claim your market share</div>
        </VStack>
        <Button variant="secondary" size="sm" className="gap-2" onClick={claim} disabled={!canClaim}>
          <ArrowDown className="h-4 w-4" />
          Claim
        </Button>
      </HStack>
      {!canClaim && <div className="text-xs text-gold/60">Claims unlock once the market is resolved.</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <VStack className="gap-1 rounded-lg border border-white/10 bg-white/5 p-3">
          <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Your share</span>
          {/* <span className="text-2xl font-semibold text-gold/90">{Number(share) > 0 ? `${shareDisplay}%` : "0%"}</span> */}
          <span className="text-2xl font-semibold text-white">{"TBD"}</span>
          <span className="text-xs text-gold/70">of accumulated fees</span>
        </VStack>

        <VStack className="gap-1 rounded-lg border border-white/10 bg-white/5 p-3">
          <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Vault balance</span>
          <HStack className="items-baseline gap-1">
            <span className="text-xl font-semibold text-white">{balanceDisplay}</span>
            <TokenIcon token={market.collateralToken} size={16} />
          </HStack>
          <span className="text-xs text-gold/70">held in this vault</span>
        </VStack>

        <VStack className="gap-1 rounded-lg border border-white/10 bg-white/5 p-3">
          <span className="text-xs uppercase tracking-[0.08em] text-gold/70">Redeemable</span>
          <HStack className="items-baseline gap-1">
            <span className="text-xl font-semibold text-white">{Number(value) > 0 ? redeemableDisplay : "0"}</span>
            <TokenIcon token={market.collateralToken} size={16} />
          </HStack>
          <span className="text-xs text-gold/70">claimable right now</span>
        </VStack>
      </div>
    </div>
  );
}
