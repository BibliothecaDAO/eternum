import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BigNumberish, Call, uint256 } from "starknet";

import { env } from "@/../env";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { RegisteredToken } from "@/pm/bindings";
import type { MarketClass, MarketOutcome } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useUser } from "@/pm/hooks/dojo/user";
import { useTokens } from "@/pm/hooks/dojo/useTokens";
import { formatUnits } from "@/pm/utils";
import { getContractByName } from "@dojoengine/core";
import { HStack, VStack } from "@pm/ui";
import { parseLordsToBaseUnits } from "../market-utils";
import { MaybeController } from "../MaybeController";
import { TokenIcon } from "../TokenIcon";

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
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
  const {
    tokens: { getBalances },
  } = useUser();

  const balances = useMemo(
    () => (token?.contract_address ? getBalances([token.contract_address]) : []),
    [getBalances, token?.contract_address],
  );

  const { balanceFormatted } = useMemo(() => {
    if (!token) return { balanceFormatted: "0" };

    const raw = balances?.[0]?.balance ? BigInt(balances[0].balance) : 0n;
    const decimals = Number(token.decimals ?? 0);
    const formatted = formatUnits(raw, decimals, 4);

    return { balanceFormatted: formatted };
  }, [balances, token]);

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
      <div className="mt-2 flex items-center justify-between text-[11px] text-gold/60">
        <span>Balance: {balanceFormatted}</span>
        <button
          type="button"
          className="rounded-sm border border-white/20 bg-white/5 px-2 py-[2px] text-[11px] font-semibold text-white transition hover:border-gold/60 hover:text-gold"
          onClick={() => setAmount(balanceFormatted)}
        >
          MAX
        </button>
      </div>
    </div>
  );
};

const DEFAULT_MARKET_ADDRESS = "";

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
}: {
  market: MarketClass;
  selectedOutcome?: MarketOutcome;
  setSelectedOutcome?: (e: MarketOutcome) => void;
}) {
  const {
    config: { manifest },
  } = useDojoSdk();
  const collateralDecimals = Number(market.collateralToken?.decimals ?? 18);
  const [amount, setAmount] = useState("0");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const account = useAccountStore((state) => state.account);

  const manifestMarketAddress = getContractByName(manifest, "pm", "Markets")?.address;
  const vaultPositionsAddress = getContractByName(manifest, "pm", "VaultPositions")?.address;
  const marketContractAddress = (env.VITE_PUBLIC_PM_ADDRESS ?? manifestMarketAddress ?? DEFAULT_MARKET_ADDRESS).trim();
  const nowSec = Math.floor(Date.now() / 1_000);
  const isResolved = market.isResolved();
  const isTradeable = !isResolved && nowSec >= market.start_at && nowSec < market.end_at;

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);

  const positionIdsAsStrings = useMemo(() => positionIds.map((id) => id.toString()), [positionIds]);

  const { balances: positionBalances } = useTokens(
    {
      accountAddresses: account?.address ? [account.address] : undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
      tokenIds: positionIdsAsStrings,
    },
    true,
  );

  const hasRedeemablePositions = useMemo(() => {
    return positionBalances.some(
      (balance) =>
        BigInt(balance.balance || 0) > 0n &&
        positionIds.some((id) => BigInt(balance.token_id || 0) === id) &&
        (!account || BigInt(balance.account_address) === BigInt(account.address || 0)),
    );
  }, [positionBalances, positionIds, account]);

  // TODO: check if that works when a market has been resovled
  const claimableAmount = useMemo(() => {
    if (!isResolved) return 0n;
    const payouts = market.conditionResolution?.payout_numerators;
    if (!payouts || payouts.length === 0) return 0n;
    const totalPayout = payouts.reduce((acc, v) => acc + BigInt(v), 0n);
    if (totalPayout === 0n) return 0n;

    const denominator = BigInt(market.vaultDenominator?.value || 0);
    if (denominator === 0n) return 0n;

    return positionBalances.reduce((acc, balance) => {
      const tokenId = BigInt(balance.token_id || 0);
      const idx = positionIds.findIndex((id) => id === tokenId);
      if (idx < 0) return acc;

      const outcomeNumerator = BigInt(market.vaultNumerators?.find((n) => Number(n.index) === idx)?.value || 0);
      if (outcomeNumerator === 0n) return acc;

      const payout = BigInt(payouts[idx] ?? 0);
      if (payout === 0n) return acc;

      const share = (payout * 10_000n) / totalPayout;
      const rewardPerUnit = (share * denominator) / outcomeNumerator;
      const payoutAmount = (rewardPerUnit * BigInt(balance.balance || 0)) / 10_000n;
      return acc + payoutAmount;
    }, 0n);
  }, [isResolved, market, positionBalances, positionIds]);

  const claimableDisplay = useMemo(() => {
    const formatted = formatUnits(claimableAmount, collateralDecimals, 4);
    return Number(formatted || 0) > 0 ? formatted : "0";
  }, [claimableAmount, collateralDecimals]);

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

  const onRedeem = async () => {
    if (!account) {
      toast.error("Connect a wallet to claim.");
      return;
    }

    if (!marketContractAddress) {
      toast.error("Market contract address is not configured.");
      return;
    }

    if (!vaultPositionsAddress) {
      toast.error("Vault positions contract address is missing.");
      return;
    }

    if (!isResolved) {
      toast.error("You can only redeem after the market is resolved.");
      return;
    }

    if (!hasRedeemablePositions) {
      toast.error("No redeemable positions found for this market.");
      return;
    }

    if (positionIds.length === 0) {
      toast.error("Unable to find position ids for this market.");
      return;
    }

    const marketIdU256 = toUint256(market.market_id);
    const positionsCalldata = positionIds.flatMap((id) => {
      const idU256 = toUint256(id);
      return [idU256.low, idU256.high];
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

    try {
      setIsSubmitting(true);

      await account.estimateInvokeFee([approveCall, redeemCall], {
        blockIdentifier: "pre_confirmed",
      });

      const resultTx = await account.execute([approveCall, redeemCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(resultTx.transaction_hash);
      }

      toast.success("Redeem submitted.");
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
    const claimDisabled = isSubmitting || !isResolved || (!!account && !hasRedeemablePositions);
    const claimMessage = !account
      ? "Connect a wallet to check if you have redeemable positions."
      : !isResolved
        ? "Claims unlock once the market is resolved."
        : !hasRedeemablePositions
          ? "No redeemable positions detected in your wallet."
          : "Redeem your position tokens to claim your payout.";

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
          onClick={onRedeem}
        >
          Claim
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
      <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner text-white">
        <VStack className="items-end gap-6">
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
          <HStack className="justify-center">
            {market.typBinary() && (
              <HStack className="w-full">
                <Button
                  className="w-1/2 bg-progress-bar-good text-white hover:bg-progress-bar-good/80"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[0]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  BUY YES
                </Button>
                <Button
                  className="w-1/2 bg-danger text-lightest hover:bg-danger/80"
                  onClick={() => {
                    setSelectedOutcome?.(outcomes[1]);
                    setIsDialogOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  BUY NO
                </Button>
              </HStack>
            )}

            {market.typCategorical() && (
              <VStack className="w-full gap-2">
                <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gold/70">
                  <span>Selected outcome</span>
                  <span className="text-white/90">
                    {selectedOutcome?.name ? <MaybeController address={selectedOutcome.name} /> : "None"}
                  </span>
                </div>
                <Button
                  className="w-full bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setIsDialogOpen(true)}
                  disabled={!selectedOutcome || isSubmitting}
                >
                  {!selectedOutcome ? "Select an outcome" : "BUY"}
                </Button>
              </VStack>
            )}
          </HStack>
        </VStack>

        <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
          </DialogHeader>

          <DialogDescription>
            <div className="my-6 flex items-center justify-center text-xl">
              <VStack>
                <Leo width="64px" height="64px" color="#f0b100" />
                <VStack className="mt-6 items-center">
                  <span>I want to buy</span>
                  <HStack className="items-center justify-center">
                    {Number(amount) > 0 ? `${amount} ${market.collateralToken?.symbol ?? ""}`.trim() : "0"}
                    <TokenIcon token={market.collateralToken} size={18} className="mx-1" />
                  </HStack>
                  <MaybeController address={selectedOutcome?.name ?? ""} />
                </VStack>
              </VStack>
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button
              className="w-full bg-white/10 text-white hover:bg-white/20"
              onClick={() => onBuy(selectedOutcome?.index ?? 0)}
              disabled={isSubmitting}
            >
              BUY
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </>
  );
}
