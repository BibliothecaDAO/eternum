import { AlertTriangle, Loader2, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BigNumberish, Call, uint256 } from "starknet";

import { useAccountStore } from "@/hooks/store/use-account-store";
import type { RegisteredToken } from "@/pm/bindings";
import type { MarketClass, MarketOutcome } from "@/pm/class";
import { ORACLE_FEE_BPS, PROTOCOL_FEE_BPS } from "@/pm/constants/market-creation-defaults";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { formatUnits } from "@/pm/utils";
import Button from "@/ui/design-system/atoms/button";
import { Panel } from "@/ui/design-system/atoms/panel";
import { getContractByName } from "@dojoengine/core";
import { parseLordsToBaseUnits } from "../market-utils";
import { MaybeController } from "../maybe-controller";
import { TokenIcon } from "../token-icon";
import { useMarketRedeem } from "../use-market-redeem";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

/**
 * Confirmation dialog rendered in a portal
 */
const TradeConfirmDialog = ({
  open,
  onClose,
  amount,
  token,
  selectedOutcome,
  potentialWin,
  userShares,
  netResult,
  isProfit,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  amount: string;
  token: RegisteredToken;
  selectedOutcome?: MarketOutcome;
  potentialWin: string | null;
  userShares: number | null;
  netResult: string | null;
  isProfit: boolean;
  onConfirm: () => void;
  isSubmitting: boolean;
}) => {
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);
  useEffect(() => {
    if (!open) setHasAcknowledgedRisk(false);
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <Panel
        tone="wood"
        padding="lg"
        radius="xl"
        border="subtle"
        className="relative mx-4 w-full max-w-sm animate-fade-in-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gold/50 transition-colors hover:bg-gold/10 hover:text-gold"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-4 text-center">
          <h3 className="font-cinzel text-lg font-semibold text-gold">Confirm Trade</h3>
        </div>

        {/* Trade Summary */}
        <div className="space-y-4">
          {/* Amount */}
          <div className="rounded-lg bg-brown/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gold/50">You are buying</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="font-cinzel text-2xl font-bold text-white">{Number(amount) > 0 ? amount : "0"}</span>
              <TokenIcon token={token} size={20} />
              <span className="text-gold/70">{token?.symbol}</span>
            </div>
          </div>

          {/* Selected Outcome */}
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-gold/50">On outcome</p>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: getOutcomeColor(selectedOutcome?.index ?? 0) }}
              />
              <span className="font-semibold text-gold">
                <MaybeController address={selectedOutcome?.name ?? ""} />
              </span>
              <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                {selectedOutcome?.odds}%
              </span>
            </div>
          </div>

          {/* Payout Summary */}
          {potentialWin && (
            <div className="rounded-lg border border-brilliance/30 bg-brilliance/10 p-3">
              <div className="space-y-2">
                {/* Shares */}
                {userShares != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gold/60">Your Shares</span>
                    <span className="font-medium text-white">{userShares.toFixed(2)}%</span>
                  </div>
                )}
                {/* Payout if Win */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gold/60">Payout if Win</span>
                  <div className="flex items-center gap-1">
                    <span className="font-cinzel text-lg font-bold text-brilliance">{potentialWin}</span>
                    <TokenIcon token={token} size={16} />
                  </div>
                </div>
                {/* Net Profit */}
                {netResult && (
                  <div className="flex items-center justify-between border-t border-gold/20 pt-2 text-xs">
                    <span className="text-gold/60">Net Profit</span>
                    <span className={isProfit ? "font-semibold text-brilliance" : "font-semibold text-danger"}>
                      {isProfit ? "+" : "-"}
                      {netResult}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk Notice */}
          <div className="rounded-lg border border-orange/30 bg-orange/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange" />
              <span className="text-xs font-semibold uppercase tracking-wide text-orange">Alpha Release</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gold/70">
              Smart contracts are not audited. Loss of funds is possible. Trade at your own risk.
            </p>
          </div>

          {/* Acknowledgment */}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasAcknowledgedRisk}
              onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-gold"
            />
            <span className="text-gold/80">I understand and accept the risks</span>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={onConfirm}
            disabled={isSubmitting || !hasAcknowledgedRisk}
            isLoading={isSubmitting}
            forceUppercase={false}
          >
            {isSubmitting ? "Confirming..." : "Confirm Trade"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="w-full"
            onClick={onClose}
            disabled={isSubmitting}
            forceUppercase={false}
          >
            Cancel
          </Button>
        </div>
      </Panel>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
};

/**
 * Token amount input with quick-add buttons
 */
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

  return (
    <div className="space-y-3">
      {/* Large centered input */}
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-[140px] bg-transparent text-center font-cinzel text-3xl text-white outline-none placeholder:text-gold/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="0"
          />
          <div className="pointer-events-none absolute right-0 top-2 translate-x-full pl-2">
            <TokenIcon token={token} size={24} />
          </div>
        </div>
        <span className="text-sm text-gold/50">{token?.symbol}</span>
      </div>

      {/* Quick-add buttons */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {[100, 500, 1000, 5000].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => addToAmount(val)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
            className="rounded-md border border-gold/30 bg-brown/50 px-2.5 py-1 text-[10px] font-medium text-gold transition-colors hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +{val >= 1000 ? `${val / 1000}k` : val}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(balanceFormatted)}
          disabled={balanceNum <= 0}
          className="rounded-md border border-gold/50 bg-gold/20 px-2.5 py-1 text-[10px] font-bold text-gold transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          MAX
        </button>
      </div>

      {/* Balance */}
      <p className="text-center text-[10px] text-gold/40">
        Balance: {balanceFormatted} {token?.symbol}
      </p>
    </div>
  );
};

const tryBetterErrorMsg = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong while submitting the trade.";
};

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
  compact?: boolean;
}) {
  const {
    config: { manifest },
  } = useDojoSdk();
  const collateralDecimals = Number(market.collateralToken?.decimals ?? 18);
  const [amount, setAmount] = useState("0");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const account = useAccountStore((state) => state.account);

  const marketContractAddress = getContractByName(manifest, "pm", "Markets")?.address;
  const nowSec = Math.floor(Date.now() / 1_000);
  const isResolved = market.isResolved();
  const isTradeable = !isResolved && nowSec >= market.start_at && nowSec < market.end_at;

  const { claimableDisplay, hasAnythingToClaim, isRedeeming, redeem } = useMarketRedeem(market);

  // Helper to calculate if a trade is profitable for a given outcome index
  const isProfitableForOutcome = useMemo(() => {
    return (outcomeIndex: number): boolean => {
      const baseAmount = parseLordsToBaseUnits(amount, collateralDecimals);
      const totalLiquidityRaw = market.vaultDenominator?.value;
      const outcomeLiquidityRaw = market.vaultNumerators?.find((num) => num.index === outcomeIndex)?.value;

      if (
        baseAmount == null ||
        baseAmount <= 0n ||
        totalLiquidityRaw == null ||
        outcomeLiquidityRaw == null ||
        BigInt(totalLiquidityRaw) <= 0n
      ) {
        return true; // No data to evaluate, allow by default
      }

      const baseAmountBig = BigInt(baseAmount);
      const modelFeeBps = BigInt(market.getModelFees(Date.now()));
      const creatorFeeBps = BigInt(market.creator_fee || 0);
      const totalFeeBps = PROTOCOL_FEE_BPS + ORACLE_FEE_BPS + modelFeeBps + creatorFeeBps;
      const effectiveAmount = (baseAmountBig * (10000n - totalFeeBps)) / 10000n;

      const outcomeLiquidity = BigInt(outcomeLiquidityRaw);
      const totalLiquidity = BigInt(totalLiquidityRaw);
      const newOutcomeLiquidity = outcomeLiquidity + effectiveAmount;
      const newTotalLiquidity = totalLiquidity + effectiveAmount;

      if (newOutcomeLiquidity === 0n || newTotalLiquidity === 0n) {
        return true;
      }

      const potentialWinRaw = (effectiveAmount * newTotalLiquidity) / newOutcomeLiquidity;
      return potentialWinRaw >= baseAmountBig;
    };
  }, [amount, collateralDecimals, market]);

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
        userShares: null,
        potentialWinFormatted: null,
        netResultFormatted: null,
        isProfit: false,
        isProfitable: true,
      };
    }

    const baseAmountBig = BigInt(baseAmount);

    // Calculate total fees in basis points (10000 = 100%)
    // Fees: protocol (0.3%) + oracle (0.5%) + model/vault fee (time-based) + creator fee
    const modelFeeBps = BigInt(market.getModelFees(Date.now()));
    const creatorFeeBps = BigInt(market.creator_fee || 0);
    const totalFeeBps = PROTOCOL_FEE_BPS + ORACLE_FEE_BPS + modelFeeBps + creatorFeeBps;

    // Deduct fees from the investment amount: effective = amount * (10000 - fees) / 10000
    const effectiveAmount = (baseAmountBig * (10000n - totalFeeBps)) / 10000n;

    const outcomeLiquidity = BigInt(outcomeLiquidityRaw);
    const totalLiquidity = BigInt(totalLiquidityRaw);
    const newOutcomeLiquidity = outcomeLiquidity + effectiveAmount;
    const newTotalLiquidity = totalLiquidity + effectiveAmount;

    if (newOutcomeLiquidity === 0n || newTotalLiquidity === 0n) {
      return {
        userShares: null,
        potentialWinFormatted: null,
        netResultFormatted: null,
        isProfit: false,
        isProfitable: true,
      };
    }

    // Parimutuel calculation:
    // User's shares = (effectiveAmount / newOutcomeLiquidity) * 100
    const userShares = Number((effectiveAmount * 10_000n) / newOutcomeLiquidity) / 100;

    // Payout if win = (shares * totalPool) / 100 = effectiveAmount * totalPool / outcomePool
    const potentialWinRaw = (effectiveAmount * newTotalLiquidity) / newOutcomeLiquidity;
    const potentialWinFormatted = formatUnits(potentialWinRaw, collateralDecimals, 4);

    // Net result = payout - initial bet
    const netResultRaw = potentialWinRaw - baseAmountBig;
    const netResultFormatted = formatUnits(netResultRaw < 0n ? -netResultRaw : netResultRaw, collateralDecimals, 4);
    const isProfit = netResultRaw > 0n;

    // Check if potential win is greater than or equal to input amount
    const isProfitable = potentialWinRaw >= baseAmountBig;

    return { userShares, potentialWinFormatted, netResultFormatted, isProfit, isProfitable };
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

      await account.estimateInvokeFee([approveCall, buyCall], { blockIdentifier: "pre_confirmed" });
      const resultTx = await account.execute([approveCall, buyCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(resultTx.transaction_hash);
      }

      toast.success("Trade submitted successfully!");
    } catch (error) {
      console.error(error);
      toast.error(tryBetterErrorMsg(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const outcomes = market.getMarketOutcomes();
  if (!outcomes) return null;

  // Resolved / Non-tradeable state
  if (!isTradeable) {
    const claimDisabled = isSubmitting || isRedeeming || !isResolved || (!!account && !hasAnythingToClaim);
    const claimMessage = !account
      ? "Connect a wallet to check claimable amounts."
      : !isResolved
        ? "Claims unlock once the market is resolved."
        : !hasAnythingToClaim
          ? "No redeemable positions detected."
          : "Claim your winnings below.";

    return isResolved ? (
      <Panel tone="wood" padding="md" radius="lg" border="subtle" className="border-brilliance/30 bg-brilliance/5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-brilliance">Resolved</span>
          <div className="flex items-center gap-2">
            <span className="font-cinzel text-xl font-bold text-brilliance">+{claimableDisplay}</span>
            <TokenIcon token={market.collateralToken} size={18} />
          </div>
        </div>
        <p className="mt-2 text-xs text-gold/60">{claimMessage}</p>
        <Button
          variant="success"
          size="md"
          className="mt-3 w-full"
          disabled={claimDisabled}
          isLoading={isRedeeming}
          onClick={() => redeem()}
          forceUppercase={false}
        >
          {isRedeeming ? "Claiming..." : "Claim Winnings"}
        </Button>
      </Panel>
    ) : (
      <Panel tone="neutral" padding="md" radius="lg" border="subtle">
        <p className="font-semibold text-gold">Trading Unavailable</p>
        <p className="mt-1 text-xs text-gold/60">{claimMessage}</p>
      </Panel>
    );
  }

  return (
    <>
      <Panel tone="wood" padding={compact ? "sm" : "md"} radius="lg" border="subtle">
        <div className={cx("space-y-4", compact && "space-y-3")}>
          {/* Amount Input */}
          <TokenAmountInput amount={amount} setAmount={setAmount} token={market.collateralToken} />

          {/* Payout Summary Display */}
          <div className="rounded-lg border border-brilliance/30 bg-brilliance/10 p-3">
            <div className="space-y-2">
              {/* Your Shares */}
              {tradePreview.userShares != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gold/60">Your Shares</span>
                  <span className="font-medium text-white">{tradePreview.userShares.toFixed(2)}%</span>
                </div>
              )}

              {/* Payout if Win */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-brilliance/70">
                  <TrendingUp className="h-3 w-3" />
                  <span>Payout if Win</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-cinzel text-xl font-bold text-brilliance">
                    {tradePreview.potentialWinFormatted ?? "--"}
                  </span>
                  <TokenIcon token={market.collateralToken} size={18} />
                </div>
              </div>

              {/* Net Profit/Loss */}
              {tradePreview.netResultFormatted && (
                <div className="flex items-center justify-between border-t border-gold/20 pt-2 text-xs">
                  <span className="text-gold/60">Net Profit</span>
                  <span
                    className={tradePreview.isProfit ? "font-semibold text-brilliance" : "font-semibold text-danger"}
                  >
                    {tradePreview.isProfit ? "+" : "-"}
                    {tradePreview.netResultFormatted}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Selected Outcome / Buy Buttons */}
          {market.typBinary() ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[0]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting || !isProfitableForOutcome(0)}
                  forceUppercase={false}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !isProfitableForOutcome(0) ? (
                    "Odds too low"
                  ) : (
                    "Buy YES"
                  )}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[1]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting || !isProfitableForOutcome(1)}
                  forceUppercase={false}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !isProfitableForOutcome(1) ? (
                    "Odds too low"
                  ) : (
                    "Buy NO"
                  )}
                </Button>
              </div>
              {(!isProfitableForOutcome(0) || !isProfitableForOutcome(1)) && (
                <p className="text-center text-xs text-danger">
                  {!isProfitableForOutcome(0) && !isProfitableForOutcome(1)
                    ? "Both outcomes have odds too low for this amount."
                    : "One outcome has odds too low. Choose a lower amount."}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Selected Outcome Display */}
              <div className="rounded-lg border border-gold/20 bg-brown/40 p-2.5">
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gold/50">Selected Outcome</p>
                {selectedOutcome ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: getOutcomeColor(selectedOutcome.index) }}
                      />
                      <span className="text-sm font-semibold text-white">
                        <MaybeController address={selectedOutcome.name} />
                      </span>
                    </div>
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                      {selectedOutcome.odds}%
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gold/40">
                    <div className="h-2.5 w-2.5 rounded-full border border-dashed border-gold/30" />
                    <span>Select an outcome above</span>
                  </div>
                )}
              </div>

              {/* Buy Button */}
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setIsDialogOpen(true)}
                disabled={!selectedOutcome || isSubmitting || !tradePreview.isProfitable}
                isLoading={isSubmitting}
                forceUppercase={false}
              >
                {!selectedOutcome
                  ? "Select outcome to trade"
                  : !tradePreview.isProfitable
                    ? "Odds too low"
                    : isSubmitting
                      ? "Confirming..."
                      : "Buy Position"}
              </Button>
              {!tradePreview.isProfitable && selectedOutcome && (
                <p className="text-center text-xs text-danger">
                  Potential win is less than your bet. Choose a lower amount or different outcome.
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Confirmation Dialog */}
      <TradeConfirmDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        amount={amount}
        token={market.collateralToken}
        selectedOutcome={selectedOutcome}
        potentialWin={tradePreview.potentialWinFormatted}
        userShares={tradePreview.userShares}
        netResult={tradePreview.netResultFormatted}
        isProfit={tradePreview.isProfit}
        onConfirm={() => onBuy(selectedOutcome?.index ?? 0)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
