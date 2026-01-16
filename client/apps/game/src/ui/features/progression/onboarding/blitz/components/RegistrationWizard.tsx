import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { Check, Coins, Loader2, UserPlus } from "lucide-react";
import { fadeInUp } from "../animations";
import { RegistrationStage } from "../types";

interface RegistrationWizardProps {
  stage: RegistrationStage;
  onRegister: () => void;
  requiresEntryToken: boolean;
  feeAmount: bigint;
  feeTokenSymbol?: string;
  className?: string;
}

interface RegistrationStep {
  id: number;
  label: string;
  icon: React.ElementType;
  description: string;
}

const REGISTRATION_STEPS_WITH_TOKEN: RegistrationStep[] = [
  {
    id: 1,
    label: "Obtain Entry Token",
    icon: TreasureChest,
    description: "Minting your entry token",
  },
  {
    id: 2,
    label: "Waiting for Token",
    icon: Coins,
    description: "Confirming token on chain",
  },
  {
    id: 3,
    label: "Register for Blitz",
    icon: UserPlus,
    description: "Completing your registration",
  },
];

const REGISTRATION_STEPS_NO_TOKEN: RegistrationStep[] = [
  {
    id: 1,
    label: "Register for Blitz",
    icon: UserPlus,
    description: "Completing your registration",
  },
];

export const RegistrationWizard = ({
  stage,
  onRegister,
  requiresEntryToken,
  feeAmount,
  feeTokenSymbol = "TOKEN",
  className = "",
}: RegistrationWizardProps) => {
  const steps = requiresEntryToken ? REGISTRATION_STEPS_WITH_TOKEN : REGISTRATION_STEPS_NO_TOKEN;
  const isProcessing = stage !== "idle" && stage !== "done" && stage !== "error";

  const getStepStatus = (stepId: number): "pending" | "active" | "complete" => {
    if (!requiresEntryToken) {
      // No token required: single step
      if (stage === "done") return "complete";
      if (stage === "registering") return "active";
      return "pending";
    }

    // With token: 3 steps
    if (stepId === 1) {
      if (stage === "obtaining-token") return "active";
      if (stage === "waiting-for-token" || stage === "registering" || stage === "done") return "complete";
      return "pending";
    }

    if (stepId === 2) {
      if (stage === "waiting-for-token") return "active";
      if (stage === "registering" || stage === "done") return "complete";
      return "pending";
    }

    if (stepId === 3) {
      if (stage === "registering") return "active";
      if (stage === "done") return "complete";
      return "pending";
    }

    return "pending";
  };

  const getProgress = (): number => {
    if (!requiresEntryToken) {
      if (stage === "done") return 100;
      if (stage === "registering") return 50;
      return 0;
    }

    switch (stage) {
      case "obtaining-token":
        return 15;
      case "waiting-for-token":
        return 45;
      case "registering":
        return 75;
      case "done":
        return 100;
      default:
        return 0;
    }
  };

  const progress = getProgress();

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`bg-gold/10 border border-gold/30 rounded-lg p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="text-center">
        <h4 className="text-gold font-semibold">Registration</h4>
        {requiresEntryToken && feeAmount > 0n && (
          <p className="text-xs text-gold/60 mt-1">
            Entry fee: {(Number(feeAmount) / 1e18).toFixed(2)} {feeTokenSymbol}
          </p>
        )}
      </div>

      {/* Progress bar - only show when processing */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="h-2 bg-brown/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold/80 to-gold rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Steps - only show when processing */}
      {isProcessing && (
        <div className="space-y-3">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  status === "active"
                    ? "bg-gold/10 border border-gold/30"
                    : status === "complete"
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "opacity-50"
                }`}
              >
                {/* Step icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    status === "complete"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : status === "active"
                        ? "bg-gold/20 text-gold"
                        : "bg-brown/30 text-gold/50"
                  }`}
                >
                  {status === "complete" ? (
                    <Check className="w-4 h-4" />
                  ) : status === "active" ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Loader2 className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Step text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        status === "complete" ? "text-emerald-400" : status === "active" ? "text-gold" : "text-gold/50"
                      }`}
                    >
                      {step.label}
                    </span>
                    {status === "active" && (
                      <span className="text-[10px] text-gold/60 animate-pulse">In progress...</span>
                    )}
                  </div>
                  <p className="text-xs text-gold/50 truncate">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={onRegister}
        disabled={isProcessing || stage === "done"}
        className={`w-full h-12 !text-brown !bg-gold rounded-md ${stage === "idle" ? "animate-pulse" : ""}`}
        forceUppercase={false}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </div>
        ) : stage === "done" ? (
          <div className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span>Registered!</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Sword className="w-5 h-5 fill-brown" />
            <span>Register</span>
          </div>
        )}
      </Button>

      {/* Error state */}
      {stage === "error" && <p className="text-xs text-red-300 text-center">Registration failed. Please try again.</p>}
    </motion.div>
  );
};
