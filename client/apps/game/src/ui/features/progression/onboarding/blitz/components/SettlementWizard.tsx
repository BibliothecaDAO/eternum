import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { Castle, Check, Loader2, MapPin, Pickaxe } from "lucide-react";
import { fadeInUp } from "../animations";
import { SettleStage } from "../types";

interface SettlementWizardProps {
  stage: SettleStage;
  assignedCount: number;
  settledCount: number;
  isSettling: boolean;
  onSettle: () => void;
  className?: string;
}

interface SettlementStep {
  id: number;
  label: string;
  icon: React.ElementType;
  description: string;
}

const SETTLEMENT_STEPS: SettlementStep[] = [
  {
    id: 1,
    label: "Assign Positions",
    icon: MapPin,
    description: "Finding optimal locations for your realms",
  },
  {
    id: 2,
    label: "Create Realms",
    icon: Castle,
    description: "Building your realm structures",
  },
  {
    id: 3,
    label: "Start Labor",
    icon: Pickaxe,
    description: "Initializing resource production",
  },
];

export const SettlementWizard = ({
  stage,
  assignedCount,
  settledCount,
  isSettling,
  onSettle,
  className = "",
}: SettlementWizardProps) => {
  const remainingToSettle = Math.max(0, assignedCount - settledCount);
  const progress = assignedCount > 0 ? (settledCount / assignedCount) * 100 : 0;

  const getStepStatus = (stepId: number): "pending" | "active" | "complete" => {
    if (stepId === 1) {
      if (assignedCount > 0) return "complete";
      if (stage === "assigning") return "active";
      return "pending";
    }

    if (stepId === 2) {
      if (assignedCount === 0) return "pending";
      if (remainingToSettle === 0 && settledCount > 0) return "complete";
      if (stage === "settling" || (remainingToSettle > 0 && settledCount > 0)) return "active";
      return "pending";
    }

    if (stepId === 3) {
      if (remainingToSettle === 0 && settledCount > 0 && stage === "done") return "complete";
      if (stage === "settling" && remainingToSettle <= 1) return "active";
      return "pending";
    }

    return "pending";
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`bg-gold/10 border border-gold/30 rounded-lg p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="text-center">
        <h4 className="text-gold font-semibold">Settlement Progress</h4>
        <p className="text-xs text-gold/60 mt-1">
          Your realm location will be automatically assigned for balanced gameplay
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 bg-brown/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-gold/80 to-gold rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        {assignedCount > 0 && (
          <div className="flex justify-between text-xs text-gold/70">
            <span>
              {settledCount} / {assignedCount} realms settled
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {SETTLEMENT_STEPS.map((step) => {
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
                  {status === "active" && <span className="text-[10px] text-gold/60 animate-pulse">In progress...</span>}
                </div>
                <p className="text-xs text-gold/50 truncate">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      <Button
        onClick={onSettle}
        disabled={isSettling || stage === "done"}
        className="w-full h-11 !text-brown !bg-gold rounded-md"
        forceUppercase={false}
      >
        {isSettling ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Settling...</span>
          </div>
        ) : stage === "done" ? (
          <div className="flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>Settlement Complete</span>
          </div>
        ) : remainingToSettle > 0 ? (
          <div className="flex items-center justify-center gap-2">
            <Castle className="w-4 h-4" />
            <span>Continue Settlement ({remainingToSettle} remaining)</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <TreasureChest className="w-4 h-4 fill-brown" />
            <span>Start Settlement</span>
          </div>
        )}
      </Button>

      {/* Error state */}
      {stage === "error" && (
        <p className="text-xs text-red-300 text-center">Settlement failed. Please try again.</p>
      )}
    </motion.div>
  );
};
