import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { fadeInUp } from "../../animations";
import { EntryTokenStatus } from "../../types";
import { CountdownTimer } from "../CountdownTimer";
import { EntryTokenWallet } from "../EntryTokenWallet";
import { PlayerCount } from "../PlayerCount";

interface RegistrationStateProps {
  entryTokenBalance: bigint;
  registrationCount: number;
  registrationEndAt: number;
  isRegistered: boolean;
  onRegister: () => Promise<void>;
  requiresEntryToken: boolean;
  onObtainEntryToken?: () => Promise<void> | void;
  isObtainingEntryToken?: boolean;
  availableEntryTokenIds?: bigint[];
  entryTokenStatus: EntryTokenStatus;
  hasSufficientFeeBalance: boolean;
  isFeeBalanceLoading: boolean;
  isLoadingEntryTokens?: boolean;
  feeAmount: bigint;
  feeTokenBalance: bigint;
  feeTokenSymbol?: string;
  className?: string;
}

export const RegistrationState = ({
  entryTokenBalance,
  registrationCount,
  registrationEndAt,
  isRegistered,
  onRegister,
  requiresEntryToken,
  onObtainEntryToken,
  isObtainingEntryToken = false,
  availableEntryTokenIds = [],
  entryTokenStatus,
  hasSufficientFeeBalance,
  isFeeBalanceLoading,
  isLoadingEntryTokens = false,
  feeAmount,
  feeTokenBalance,
  feeTokenSymbol = "TOKEN",
  className = "",
}: RegistrationStateProps) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const tokenReady = !requiresEntryToken || availableEntryTokenIds.length > 0;

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await onRegister();
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="text-center space-y-4">
        <h3 className="text-xl font-bold text-gold">Registration Open</h3>
        <PlayerCount count={registrationCount} />
        <CountdownTimer targetTime={registrationEndAt} label="Registration closes in:" />
      </div>

      {/* Registration content */}
      <div className="space-y-4">
        {isRegistered ? (
          <RegisteredConfirmation />
        ) : (
          <div className="space-y-4">
            {/* Entry token wallet */}
            {requiresEntryToken && (
              <EntryTokenWallet
                entryTokenBalance={entryTokenBalance}
                feeAmount={feeAmount}
                feeTokenBalance={feeTokenBalance}
                feeTokenSymbol={feeTokenSymbol}
                hasSufficientFeeBalance={hasSufficientFeeBalance}
                isFeeBalanceLoading={isFeeBalanceLoading}
                isObtainingToken={isObtainingEntryToken}
                entryTokenStatus={entryTokenStatus}
                isLoadingTokens={isLoadingEntryTokens}
                availableTokenCount={availableEntryTokenIds.length}
                onObtainToken={() => onObtainEntryToken?.()}
              />
            )}

            {/* Register button */}
            <Button
              onClick={handleRegister}
              disabled={isRegistering || !tokenReady}
              className={`w-full h-12 !text-brown !bg-gold rounded-md ${tokenReady ? "animate-pulse" : ""}`}
              forceUppercase={false}
            >
              {isRegistering ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Registering...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Sword className="w-5 h-5 fill-brown" />
                  <span>Register for Blitz</span>
                </div>
              )}
            </Button>

            {/* Token requirement hint */}
            {requiresEntryToken && !tokenReady && (
              <p className="text-xs text-gold/50 text-center">
                Obtain an entry token above before registering
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Registered confirmation sub-component
const RegisteredConfirmation = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 text-center"
  >
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
      <CheckCircle className="w-8 h-8 text-emerald-400" />
    </div>
    <h4 className="text-lg font-semibold text-emerald-400">You're Registered!</h4>
    <p className="text-sm text-gold/70 mt-2">
      Your spot is secured. The game will begin when registration closes.
    </p>
    <div className="mt-4 pt-4 border-t border-emerald-500/20">
      <p className="text-xs text-gold/50">
        Prepare your strategy while you wait. Good luck, commander!
      </p>
    </div>
  </motion.div>
);
