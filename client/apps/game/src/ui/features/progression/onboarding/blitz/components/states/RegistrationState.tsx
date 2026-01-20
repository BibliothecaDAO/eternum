import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { fadeInUp } from "../../animations";
import { RegistrationStage } from "../../types";
import { CountdownTimer } from "../CountdownTimer";
import { PlayerCount } from "../PlayerCount";
import { RegistrationWizard } from "../RegistrationWizard";

interface RegistrationStateProps {
  registrationCount: number;
  registrationEndAt: number;
  isRegistered: boolean;
  onRegister: () => void;
  requiresEntryToken: boolean;
  registrationStage: RegistrationStage;
  feeAmount: bigint;
  feeTokenSymbol?: string;
  className?: string;
}

export const RegistrationState = ({
  registrationCount,
  registrationEndAt,
  isRegistered,
  onRegister,
  requiresEntryToken,
  registrationStage,
  feeAmount,
  feeTokenSymbol = "TOKEN",
  className = "",
}: RegistrationStateProps) => {
  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className={`space-y-6 ${className}`}>
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
          <RegistrationWizard
            stage={registrationStage}
            onRegister={onRegister}
            requiresEntryToken={requiresEntryToken}
            feeAmount={feeAmount}
            feeTokenSymbol={feeTokenSymbol}
          />
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
    <p className="text-sm text-gold/70 mt-2">Your spot is secured. The game will begin when registration closes.</p>
    <div className="mt-4 pt-4 border-t border-emerald-500/20">
      <p className="text-xs text-gold/50">Prepare your strategy while you wait. Good luck, commander!</p>
    </div>
  </motion.div>
);
