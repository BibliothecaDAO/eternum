import { useState } from "react";
import { toast } from "sonner";
import { BigNumberish, Call, uint256 } from "starknet";

import { env } from "@/../env";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { MarketClass, MarketOutcome } from "@/pm/class";
import { HStack, VStack } from "@pm/ui";
import { MaybeController } from "../MaybeController";
import { parseLordsToBaseUnits } from "../market-utils";
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
  token: { symbol?: string };
}) => (
  <label className="flex w-full flex-col gap-2 text-xs text-gold/70">
    <span>Amount ({token?.symbol ?? "Token"})</span>
    <input
      type="number"
      min="0"
      step="0.01"
      className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-gold/60"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
    />
  </label>
);

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
  const [amount, setAmount] = useState("0");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const account = useAccountStore((state) => state.account);

  const marketAddress = env.VITE_PUBLIC_PM_ADDRESS ?? DEFAULT_MARKET_ADDRESS;
  const nowSec = Math.floor(Date.now() / 1_000);
  const isTradeable = nowSec >= market.start_at && nowSec < market.end_at;

  const onBuy = async (outcomeIndex: number) => {
    if (!account) {
      toast.error("Connect a wallet to trade.");
      return;
    }

    const targetMarketAddress = marketAddress.trim();
    if (!targetMarketAddress) {
      toast.error("Market contract address is not configured (VITE_PUBLIC_PM_ADDRESS).");
      return;
    }

    const collateralAddress = market.collateral_token || market.collateralToken?.contract_address;
    if (!collateralAddress) {
      toast.error("Collateral token address is missing.");
      return;
    }

    const baseAmount = parseLordsToBaseUnits(amount, market.collateralToken?.decimals ?? 18);
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
      calldata: [targetMarketAddress, amountU256.low, amountU256.high],
    };

    const buyCall: Call = {
      contractAddress: targetMarketAddress,
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
    return (
      <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner text-white">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-[0.08em] text-gold/70">Trading</p>
          <p className="text-lg font-semibold">Market closed</p>
          <p className="text-sm text-gold/70">Trading is unavailable because the market is not live.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gold/70">
          <span className="font-semibold text-white">Claim rewards</span>
          <span>Claiming is not implemented yet.</span>
          <Button className="w-full bg-white/10 text-white" disabled>
            Claim (coming soon)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner text-white">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-[0.08em] text-gold/70">Trading</p>
          <p className="text-lg font-semibold text-white">Place a trade</p>
        </div>

        <VStack className="items-end gap-6">
          <TokenAmountInput amount={amount} setAmount={setAmount} token={market.collateralToken} />
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
                    <TokenIcon token={market.collateralToken} className="mx-1" />
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
