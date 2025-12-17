import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, Coins, Loader2 } from "lucide-react";
import { fadeInUp } from "../animations";
import { EntryTokenStatus } from "../types";
import { formatTokenAmount } from "../utils";

interface EntryTokenWalletProps {
  entryTokenBalance: bigint;
  feeAmount: bigint;
  feeTokenBalance: bigint;
  feeTokenSymbol?: string;
  hasSufficientFeeBalance: boolean;
  isFeeBalanceLoading: boolean;
  isObtainingToken: boolean;
  entryTokenStatus: EntryTokenStatus;
  isLoadingTokens: boolean;
  availableTokenCount: number;
  onObtainToken: () => void;
  className?: string;
}

export const EntryTokenWallet = ({
  entryTokenBalance,
  feeAmount,
  feeTokenBalance,
  feeTokenSymbol = "TOKEN",
  hasSufficientFeeBalance,
  isFeeBalanceLoading,
  isObtainingToken,
  entryTokenStatus,
  isLoadingTokens,
  availableTokenCount,
  onObtainToken,
  className = "",
}: EntryTokenWalletProps) => {
  const hasToken = availableTokenCount > 0;

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`bg-brown/10 border border-brown/30 rounded-lg p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gold">
          <TreasureChest className="w-5 h-5 fill-gold" />
          <span className="font-medium">Entry Tokens</span>
        </div>
        <div className="flex items-center gap-2">
          {hasToken ? (
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Ready
            </span>
          ) : (
            <span className="text-sm text-gold/60">Required to register</span>
          )}
        </div>
      </div>

      {/* Token balance */}
      <div className="flex items-center justify-between p-3 bg-gold/5 rounded-lg border border-gold/20">
        <span className="text-sm text-gold/70">Tokens in wallet</span>
        <span className="text-lg font-semibold text-gold">{entryTokenBalance.toString()}</span>
      </div>

      {/* Fee balance section */}
      {feeAmount > 0n && (
        <div className="space-y-2 p-3 rounded-lg bg-brown/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gold/70 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              Registration fee
            </span>
            <span className="font-semibold text-gold">
              {formatTokenAmount(feeAmount)} <span className="text-gold/60">{feeTokenSymbol}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gold/70">Your balance</span>
            <span className={hasSufficientFeeBalance ? "text-gold" : "text-red-300"}>
              {isFeeBalanceLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  {formatTokenAmount(feeTokenBalance)} <span className="opacity-60">{feeTokenSymbol}</span>
                </>
              )}
            </span>
          </div>
          {!hasSufficientFeeBalance && (
            <p className="text-xs text-amber-300 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              Balance will be auto-topped when obtaining token
            </p>
          )}
        </div>
      )}

      {/* Obtain token button */}
      {!hasToken && (
        <Button
          onClick={onObtainToken}
          disabled={isObtainingToken}
          className="w-full h-11 !text-brown !bg-gold/90 hover:!bg-gold rounded-md"
          forceUppercase={false}
        >
          {isObtainingToken ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Minting token...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <TreasureChest className="w-4 h-4 fill-brown" />
              <span>Obtain Entry Token</span>
            </div>
          )}
        </Button>
      )}

      {/* Status messages */}
      <div className="space-y-1">
        {entryTokenStatus === "minting" && (
          <p className="text-xs text-gold/60 text-center flex items-center justify-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Minting your entry token...
          </p>
        )}
        {entryTokenStatus === "error" && (
          <p className="text-xs text-red-300 text-center flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Mint failed. Please try again.
          </p>
        )}
        {isLoadingTokens && <p className="text-xs text-gold/60 text-center">Checking for entry tokens...</p>}
        {!isLoadingTokens && entryTokenStatus === "timeout" && entryTokenBalance === 0n && (
          <p className="text-xs text-gold/60 text-center">
            Minted! Waiting for token to appear. Try again shortly if it doesn't show.
          </p>
        )}
        {!isLoadingTokens && hasToken && (
          <p className="text-xs text-emerald-400/80 text-center flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Entry token detected. You can now register.
          </p>
        )}
      </div>

      {/* Info text */}
      <p className="text-xs text-gold/50 text-center">
        The entry token will be locked automatically when you register.
      </p>
    </motion.div>
  );
};
