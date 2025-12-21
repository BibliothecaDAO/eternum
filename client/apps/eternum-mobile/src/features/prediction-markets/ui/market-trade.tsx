import { MarketClass, type MarketOutcome } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { formatUnits } from "@/pm/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { getContractByName } from "@dojoengine/core";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Call, uint256 } from "starknet";
import { parseLordsToBaseUnits } from "../lib/market-utils";
import { useMarketRedeem } from "../lib/use-market-redeem";
import { MaybeController } from "./maybe-controller";
import { TokenIcon } from "./token-icon";

interface MarketTradeProps {
  market: MarketClass;
  selectedOutcome?: MarketOutcome;
  setSelectedOutcome?: (outcome: MarketOutcome) => void;
}

const toUint256 = (value: bigint | string) => {
  const asUint = uint256.bnToUint256(BigInt(value));
  return { low: asUint.low, high: asUint.high };
};

const TokenAmountInput = ({
  amount,
  setAmount,
  symbol,
  balance,
}: {
  amount: string;
  setAmount: (val: string) => void;
  symbol?: string;
  balance?: string;
}) => (
  <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3 text-xs text-muted-foreground">
    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
      <span>Amount</span>
      <span className="text-xs font-semibold text-foreground">{symbol ?? "TOKEN"}</span>
    </div>
    <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
      <span>Balance: {balance ?? "0"}</span>
      <button
        type="button"
        className="rounded border border-border/60 px-2 py-1 text-[10px] font-semibold text-foreground"
        onClick={() => setAmount(balance ?? "0")}
      >
        MAX
      </button>
    </div>
  </div>
);

export function MarketTrade({ market, selectedOutcome, setSelectedOutcome }: MarketTradeProps) {
  const {
    config: { manifest },
  } = useDojoSdk();
  const { lordsBalance } = useUser();
  const account = useStore((state) => state.account);
  const collateralDecimals = Number(market.collateralToken?.decimals ?? 18);
  const [amount, setAmount] = useState("0");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketContractAddress = getContractByName(manifest, "pm", "Markets")?.address;
  const nowSec = Math.floor(Date.now() / 1_000);
  const isResolved = market.isResolved();
  const isTradeable = !isResolved && nowSec >= market.start_at && nowSec < market.end_at;

  const { claimableDisplay, hasRedeemablePositions, isRedeeming, redeem, error: redeemError } = useMarketRedeem(market);

  const formattedBalance = useMemo(() => {
    const decimals = Number(market.collateralToken?.decimals ?? 18);
    return formatUnits(lordsBalance, decimals, 4);
  }, [lordsBalance, market.collateralToken?.decimals]);

  const tradePreview = useMemo(() => {
    const baseAmount = parseLordsToBaseUnits(amount, collateralDecimals);
    const totalLiquidityRaw = market.vaultDenominator?.value;
    const outcomeIndex = selectedOutcome?.index;
    const outcomeLiquidityRaw =
      outcomeIndex != null ? market.vaultNumerators?.find((num) => num.index === outcomeIndex)?.value : undefined;

    if (baseAmount == null || baseAmount <= 0n || totalLiquidityRaw == null || outcomeLiquidityRaw == null) {
      return { averageEntryPercent: null, potentialWinFormatted: null };
    }

    const baseAmountBig = BigInt(baseAmount);
    const outcomeLiquidity = BigInt(outcomeLiquidityRaw);
    const totalLiquidity = BigInt(totalLiquidityRaw);

    const newOutcomeLiquidity = outcomeLiquidity + baseAmountBig;
    const newTotalLiquidity = totalLiquidity + baseAmountBig;
    if (newOutcomeLiquidity === 0n || newTotalLiquidity === 0n) {
      return { averageEntryPercent: null, potentialWinFormatted: null };
    }

    const averageEntryPercent = Number((newOutcomeLiquidity * 10_000n) / newTotalLiquidity) / 100;
    const potentialWinRaw = (baseAmountBig * newTotalLiquidity) / newOutcomeLiquidity;
    const potentialWinFormatted = formatUnits(potentialWinRaw, collateralDecimals, 4);

    return { averageEntryPercent, potentialWinFormatted };
  }, [amount, collateralDecimals, market, selectedOutcome]);

  const onBuy = async (outcomeIndex: number) => {
    setError(null);

    if (!account) {
      setError("Connect a wallet to trade.");
      return;
    }

    if (!marketContractAddress) {
      setError("Market contract address is not configured.");
      return;
    }

    const collateralAddress = market.collateral_token || market.collateralToken?.contract_address;
    if (!collateralAddress) {
      setError("Collateral token address is missing.");
      return;
    }

    const baseAmount = parseLordsToBaseUnits(amount, collateralDecimals);
    if (baseAmount == null || baseAmount <= 0n) {
      setError("Enter a valid amount greater than 0.");
      return;
    }

    const marketIdU256 = toUint256(market.market_id);
    const amountU256 = toUint256(baseAmount);

    const approveCall: Call = {
      contractAddress: collateralAddress,
      entrypoint: "approve",
      calldata: [marketContractAddress, amountU256.low, amountU256.high],
    };

    const buyCall: Call = {
      contractAddress: marketContractAddress,
      entrypoint: "buy",
      calldata: [marketIdU256.low, marketIdU256.high, outcomeIndex, amountU256.low, amountU256.high],
    };

    try {
      setIsSubmitting(true);
      setIsDialogOpen(false);

      if ("estimateInvokeFee" in account && typeof account.estimateInvokeFee === "function") {
        await account.estimateInvokeFee([approveCall, buyCall], { blockIdentifier: "pre_confirmed" });
      }

      const resultTx = await account.execute([approveCall, buyCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(resultTx.transaction_hash);
      }
    } catch (caughtError) {
      console.error(caughtError);
      setError("Something went wrong while submitting the trade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const outcomes = market.getMarketOutcomes();
  if (!outcomes) return null;

  if (!isTradeable) {
    const claimDisabled = isSubmitting || isRedeeming || !isResolved || (!!account && !hasRedeemablePositions);
    const claimMessage = !account
      ? "Connect a wallet to check if you have redeemable positions."
      : !isResolved
        ? "Claims unlock once the market is resolved."
        : !hasRedeemablePositions
          ? "No redeemable positions detected in your wallet."
          : "Redeem your position tokens to claim your payout.";

    return isResolved ? (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-emerald-200">Resolved — Claim</span>
          <span className="flex items-center gap-2 text-base font-semibold text-emerald-200">
            <span className="text-lg">+{claimableDisplay}</span>
            <TokenIcon token={market.collateralToken} size={16} />
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{claimMessage}</span>
        {redeemError ? <span className="text-xs text-destructive">{redeemError}</span> : null}
        <Button className="w-full" variant="secondary" disabled={claimDisabled} onClick={() => redeem()}>
          <span className="flex items-center justify-center gap-2">
            {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isRedeeming ? "Submitting..." : "Claim"}
          </span>
        </Button>
      </div>
    ) : (
      <div className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm text-muted-foreground">
        {claimMessage}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 rounded-lg border border-border/60 bg-card/80 p-4">
        <TokenAmountInput
          amount={amount}
          setAmount={setAmount}
          symbol={market.collateralToken?.symbol}
          balance={formattedBalance}
        />
        <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-wide text-muted-foreground">To win</span>
            <div className="flex items-center gap-2 text-base font-semibold text-emerald-200">
              <span>{tradePreview.potentialWinFormatted ?? "--"}</span>
              <TokenIcon token={market.collateralToken} size={16} />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>If your selected outcome resolves true.</span>
            <span className="flex items-center gap-1 text-foreground">
              Avg entry:{" "}
              <span className="font-semibold text-emerald-200">
                {tradePreview.averageEntryPercent != null ? `${tradePreview.averageEntryPercent.toFixed(2)}%` : "--"}
              </span>
            </span>
          </div>
        </div>

        {error ? <div className="text-xs text-destructive">{error}</div> : null}

        {market.typBinary() ? (
          <div className="flex w-full gap-2">
            <Button
              className="w-1/2"
              onClick={() => {
                setSelectedOutcome?.(outcomes[0]);
                setIsDialogOpen(true);
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Submitting..." : "Buy Yes"}
            </Button>
            <Button
              className="w-1/2"
              variant="secondary"
              onClick={() => {
                setSelectedOutcome?.(outcomes[1]);
                setIsDialogOpen(true);
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Submitting..." : "Buy No"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
              <span className="text-muted-foreground">Selected outcome</span>
              <span className="text-foreground">
                {selectedOutcome?.name ? <MaybeController address={selectedOutcome.name} /> : "None"}
              </span>
            </div>
            <Button
              className="w-full"
              onClick={() => setIsDialogOpen(true)}
              disabled={!selectedOutcome || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!selectedOutcome ? "Select an outcome" : isSubmitting ? "Submitting..." : "Buy"}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setHasAcknowledgedRisk(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm trade</DialogTitle>
            <DialogDescription>Review the trade details before submitting.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border/60 bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                {Number(amount) > 0 ? amount : "0"} {market.collateralToken?.symbol}
                <TokenIcon token={market.collateralToken} size={16} />
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Outcome</div>
              <div className="text-sm font-semibold">
                {selectedOutcome?.name ? <MaybeController address={selectedOutcome.name} /> : "Not selected"}
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              This prediction market is in alpha. Smart contracts have not been audited. Proceed at your own risk.
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={hasAcknowledgedRisk}
                onChange={(event) => setHasAcknowledgedRisk(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>I understand the risks and wish to proceed.</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => onBuy(selectedOutcome?.index ?? 0)}
              disabled={isSubmitting || !hasAcknowledgedRisk}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Submitting..." : "Confirm Buy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
