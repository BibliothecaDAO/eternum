import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BigNumberish, Call, uint256 } from "starknet";

import { useAccountStore } from "@/hooks/store/use-account-store";
import type { RegisteredToken } from "@/pm/bindings";
import type { MarketClass, MarketOutcome } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { formatUnits } from "@/pm/utils";
import { getContractByName } from "@dojoengine/core";
import { HStack, VStack } from "@pm/ui";
import { parseLordsToBaseUnits } from "../market-utils";
import { MaybeController } from "../maybe-controller";
import { TokenIcon } from "../token-icon";
import { useMarketRedeem } from "../use-market-redeem";

// Lightweight stand-ins for UI pieces used in the reference implementation.
const Button = ({
  children,
  className,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${disabled ? "opacity-60" : ""} ${className || ""}`}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

const Dialog = ({ open, children, onClose }: { open: boolean; children: React.ReactNode; onClose?: () => void }) => {
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative min-w-[300px] max-w-[360px] rounded-lg border border-white/10 bg-black/90 p-6 shadow-2xl">
        {onClose ? (
          <button
            className="absolute right-3 top-3 rounded-sm bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );

  // Render in a portal so the overlay is not clipped by scrollable parents.
  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
};

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 text-center">{children}</div>
);
const DialogFooter = ({ children }: { children: React.ReactNode }) => <div className="mt-6">{children}</div>;
const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold">{children}</h3>
);
const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-center text-sm text-gold/70">{children}</div>
);

const Leo = ({
  width = "48px",
  height = "48px",
  color = "#dfaa54",
}: {
  width?: string;
  height?: string;
  color?: string;
}) => (
  <div
    className="mx-auto rounded-full"
    style={{
      width,
      height,
      background: color,
      opacity: 0.8,
    }}
  />
);

const TokenAmountInput = ({
  amount,
  setAmount,
  token,
}: {
  amount: string;
  setAmount: (val: string) => void;
  token: RegisteredToken;
}) => {
  const { lordsBalance } = useUser();

  const decimals = useMemo(() => Number(token?.decimals ?? 0), [token]);
  const balanceFormatted = useMemo(() => {
    if (!token) return "0";
    return formatUnits(lordsBalance, decimals, 4);
  }, [lordsBalance, token, decimals]);
  const balanceNum = useMemo(() => parseFloat(balanceFormatted.replace(/,/g, "")) || 0, [balanceFormatted]);

  const addToAmount = (toAdd: number) => {
    const current = parseFloat(amount) || 0;
    const total = Math.min(current + toAdd, balanceNum);
    setAmount(total.toString());
  };

  const quickAddButtonClass =
    "rounded-sm border border-white/20 bg-white/5 px-1.5 py-[2px] text-[10px] font-semibold text-gold/80 transition hover:border-gold/60 hover:bg-gold/10 hover:text-gold";

  return (
    <div className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-3 text-xs text-gold/70">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-gold/60">
        <span>Amount</span>
        <span className="flex items-center gap-2 text-[11px] text-gold/60">
          <TokenIcon token={token} size={16} />
          <span className="uppercase">{token?.symbol}</span>
        </span>
      </div>
      <input
        type="number"
        min="0"
        step="0.01"
        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-lg text-white outline-none focus:border-gold/60"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {/* Fix flex overflow for button row in small containers */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gold/60">
        <span className="flex-shrink-0 truncate">Balance: {balanceFormatted}</span>
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(100)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +100
          </button>
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(1000)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +1k
          </button>
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(10000)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +10k
          </button>
          <button
            type="button"
            className="rounded-sm border border-gold/40 bg-gold/10 px-2 py-[2px] text-[11px] font-semibold text-gold transition hover:border-gold/60 hover:bg-gold/20"
            onClick={() => setAmount(balanceFormatted)}
            disabled={balanceNum <= 0}
          >
            MAX
          </button>
        </div>
      </div>
    </div>
  );
};

const tryBetterErrorMsg = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong while submitting the trade.";
};

// Utility to safely get u256 {low, high} from a value.
function toUint256(val: BigNumberish) {
  const asUint = uint256.bnToUint256(BigInt(val));
  return { low: asUint.low, high: asUint.high };
}

export function MarketTrade({
  market,
  selectedOutcome,
  setSelectedOutcome,
  compact = false,
}: {
  market: MarketClass;
  selectedOutcome?: MarketOutcome;
  setSelectedOutcome?: (e: MarketOutcome) => void;
  /** When true, reduces padding and gaps for constrained layouts (e.g., sticky panels) */
  compact?: boolean;
}) {
  const {
    config: { manifest },
  } = useDojoSdk();
  const collateralDecimals = Number(market.collateralToken?.decimals ?? 18);
  const [amount, setAmount] = useState("0");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);
  const account = useAccountStore((state) => state.account);

  const marketContractAddress = getContractByName(manifest, "pm", "Markets")?.address;
  const nowSec = Math.floor(Date.now() / 1_000);
  const isResolved = market.isResolved();
  const isTradeable = !isResolved && nowSec >= market.start_at && nowSec < market.end_at;

  const { claimableDisplay, hasAnythingToClaim, isRedeeming, redeem } = useMarketRedeem(market);

  const tradePreview = useMemo(() => {
    const baseAmount = parseLordsToBaseUnits(amount, collateralDecimals);
    const totalLiquidityRaw = market.vaultDenominator?.value;
    const outcomeIndex = selectedOutcome?.index;
    const outcomeLiquidityRaw =
      outcomeIndex != null ? market.vaultNumerators?.find((num) => num.index === outcomeIndex)?.value : undefined;

    if (
      baseAmount == null ||
      baseAmount <= 0n ||
      totalLiquidityRaw == null ||
      outcomeLiquidityRaw == null ||
      BigInt(totalLiquidityRaw) <= 0n
    ) {
      return {
        averageEntryPercent: null,
        potentialWinFormatted: null,
      };
    }

    const baseAmountBig = BigInt(baseAmount);
    const outcomeLiquidity = BigInt(outcomeLiquidityRaw);
    const totalLiquidity = BigInt(totalLiquidityRaw);

    const newOutcomeLiquidity = outcomeLiquidity + baseAmountBig;
    const newTotalLiquidity = totalLiquidity + baseAmountBig;

    if (newOutcomeLiquidity === 0n || newTotalLiquidity === 0n) {
      return {
        averageEntryPercent: null,
        potentialWinFormatted: null,
      };
    }

    // Average execution price equals the post-trade probability in this pari-mutuel model.
    const averageEntryPercent = Number((newOutcomeLiquidity * 10_000n) / newTotalLiquidity) / 100;
    const potentialWinRaw = (baseAmountBig * newTotalLiquidity) / newOutcomeLiquidity;
    const potentialWinFormatted = formatUnits(potentialWinRaw, collateralDecimals, 4);

    return {
      averageEntryPercent,
      potentialWinFormatted,
    };
  }, [amount, collateralDecimals, market, selectedOutcome]);

  const onBuy = async (outcomeIndex: number) => {
    if (!account) {
      toast.error("Connect a wallet to trade.");
      return;
    }

    if (!marketContractAddress) {
      toast.error("Market contract address is not configured.");
      return;
    }

    const collateralAddress = market.collateral_token || market.collateralToken?.contract_address;
    if (!collateralAddress) {
      toast.error("Collateral token address is missing.");
      return;
    }

    const baseAmount = parseLordsToBaseUnits(amount, collateralDecimals);
    if (baseAmount == null || baseAmount <= 0n) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }

    // Always encode u256 params as [low, high] (Cairo expects this format).
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

      await account.estimateInvokeFee([approveCall, buyCall], {
        blockIdentifier: "pre_confirmed",
      });

      const resultTx = await account.execute([approveCall, buyCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(resultTx.transaction_hash);
      }

      toast.success("Trade submitted.");
    } catch (error) {
      console.error(error);
      toast.error(tryBetterErrorMsg(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const outcomes = market.getMarketOutcomes();
  if (!outcomes) return null;

  if (!isTradeable) {
    const claimDisabled = isSubmitting || isRedeeming || !isResolved || (!!account && !hasAnythingToClaim);
    const claimMessage = !account
      ? "Connect a wallet to check if you have claimable amounts."
      : !isResolved
        ? "Claims unlock once the market is resolved."
        : !hasAnythingToClaim
          ? "No redeemable positions or vault fees detected in your wallet."
          : "Claim your position tokens and vault fees.";

    return isResolved ? (
      <div className="flex flex-col gap-3 rounded-lg border border-progress-bar-good/30 bg-progress-bar-good/5 p-4 text-sm text-gold/80">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.08em] text-progress-bar-good">Resolved — Claim</span>
          <span className="flex items-center gap-2 text-base font-semibold text-progress-bar-good">
            <span className="text-lg">+{claimableDisplay}</span>
            <TokenIcon token={market.collateralToken} size={16} />
          </span>
        </div>
        <span className="text-xs text-gold/70">{claimMessage}</span>
        <Button
          className="w-full bg-progress-bar-good/80 text-white hover:bg-progress-bar-good"
          disabled={claimDisabled}
          onClick={() => redeem()}
          // Show loading feedback while submitting claim
        >
          <span className="flex items-center justify-center gap-2">
            {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isRedeeming ? "Submitting..." : "Claim"}
          </span>
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gold/70">
        <span className="font-semibold text-white">Trading unavailable</span>
        <span>{claimMessage}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className={`w-full rounded-lg border border-white/10 bg-black/40 shadow-inner text-white ${compact ? "p-2" : "p-4"}`}
      >
        <VStack className={`items-end ${compact ? "gap-2" : "gap-6"}`}>
          <TokenAmountInput amount={amount} setAmount={setAmount} token={market.collateralToken} />
          <div className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gold/70">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.08em] text-gold/60">To win</span>
              <div className="flex items-center gap-2 text-base font-semibold text-progress-bar-good">
                <span>{tradePreview.potentialWinFormatted ?? "--"}</span>
                <TokenIcon token={market.collateralToken} size={16} />
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gold/60">
              <span>If your selected outcome resolves true.</span>
              <span className="flex items-center gap-1 text-white/80">
                Avg entry:{" "}
                <span className="font-semibold text-progress-bar-good">
                  {tradePreview.averageEntryPercent != null ? `${tradePreview.averageEntryPercent.toFixed(2)}%` : "--"}
                </span>
              </span>
            </div>
          </div>
          <HStack className="justify-center w-full">
            {market.typBinary() && (
              <HStack className="w-full">
                <Button
                  className="w-1/2 bg-progress-bar-good text-white hover:bg-progress-bar-good/80 flex items-center justify-center gap-2"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[0]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? "Submitting..." : "BUY YES"}
                </Button>
                <Button
                  className="w-1/2 bg-danger text-lightest hover:bg-danger/80 flex items-center justify-center gap-2"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[1]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? "Submitting..." : "BUY NO"}
                </Button>
              </HStack>
            )}

            {market.typCategorical() && (
              <VStack className={`w-full ${compact ? "gap-2" : "gap-3"}`}>
                <div
                  className={`w-full overflow-hidden rounded-md border border-white/10 bg-white/5 ${compact ? "p-2" : "p-3"}`}
                >
                  <div className={`${compact ? "mb-1" : "mb-2"} text-[11px] uppercase tracking-[0.08em] text-gold/60`}>
                    Selected Outcome
                  </div>
                  {selectedOutcome ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                          <MaybeController address={selectedOutcome.name} />
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-gold">
                          {selectedOutcome.odds}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gold/50">
                      <div className="h-2 w-2 rounded-full border border-dashed border-gold/30" />
                      <span>Click an outcome above to select</span>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full bg-gold/90 text-black hover:bg-gold flex items-center justify-center gap-2 font-bold"
                  onClick={() => setIsDialogOpen(true)}
                  disabled={!selectedOutcome || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {!selectedOutcome ? "Select an outcome to buy" : isSubmitting ? "Submitting..." : "BUY"}
                </Button>
              </VStack>
            )}
          </HStack>
        </VStack>

        <Dialog
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setHasAcknowledgedRisk(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
          </DialogHeader>

          <DialogDescription>
            <div className="my-4 flex items-center justify-center text-xl">
              <VStack>
                <Leo width="64px" height="64px" color="#f0b100" />
                <VStack className="mt-4 items-center">
                  <span>I want to buy</span>
                  <HStack className="items-center justify-center">
                    {Number(amount) > 0 ? `${amount} ${market.collateralToken?.symbol ?? ""}`.trim() : "0"}
                    <TokenIcon token={market.collateralToken} size={18} className="mx-1" />
                  </HStack>
                  <MaybeController address={selectedOutcome?.name ?? ""} />
                </VStack>
              </VStack>
            </div>

            <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-left text-xs text-gold/80">
              <p className="mb-2 font-semibold uppercase tracking-wide text-gold">Alpha Release Notice</p>
              <p className="leading-relaxed">
                This prediction market feature is currently in alpha. Smart contracts have not been formally audited. By
                proceeding, you acknowledge that loss of funds is possible and you are participating at your own risk.
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2 text-left text-xs text-white/80">
              <input
                type="checkbox"
                checked={hasAcknowledgedRisk}
                onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-gold"
              />
              <span>I understand the risks and wish to proceed</span>
            </label>
          </DialogDescription>
          <DialogFooter>
            <Button
              className="w-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center gap-2"
              onClick={() => onBuy(selectedOutcome?.index ?? 0)}
              disabled={isSubmitting || !hasAcknowledgedRisk}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Submitting..." : "BUY"}
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </>
  );
}
