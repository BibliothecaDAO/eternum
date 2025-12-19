import { motion } from "framer-motion";
import { Check, Circle, Coins, Globe, Scroll, Swords, Castle } from "lucide-react";
import { BlitzStep } from "../types";
import { stepVariants } from "../animations";

interface BlitzProgressProps {
  currentStep: BlitzStep;
  completedSteps: BlitzStep[];
  className?: string;
}

const STEPS: { id: BlitzStep; label: string; icon: React.ElementType }[] = [
  { id: "select-game", label: "Select", icon: Globe },
  { id: "obtain-token", label: "Token", icon: Coins },
  { id: "register", label: "Register", icon: Scroll },
  { id: "settle", label: "Settle", icon: Castle },
  { id: "play", label: "Play", icon: Swords },
];

export const BlitzProgress = ({ currentStep, completedSteps, className = "" }: BlitzProgressProps) => {
  const getStepState = (stepId: BlitzStep): "inactive" | "active" | "complete" => {
    if (completedSteps.includes(stepId)) return "complete";
    if (currentStep === stepId) return "active";
    return "inactive";
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className={`w-full ${className}`}>
      {/* Progress bar */}
      <div className="relative flex items-center justify-between">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-gold/20" />

        {/* Progress line */}
        <motion.div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-gold"
          initial={{ width: "0%" }}
          animate={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Steps */}
        {STEPS.map((step, index) => {
          const state = getStepState(step.id);
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              className="relative z-10 flex flex-col items-center"
              variants={stepVariants}
              initial="inactive"
              animate={state}
            >
              {/* Step circle */}
              <motion.div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${
                    state === "complete"
                      ? "bg-gold border-gold text-brown"
                      : state === "active"
                        ? "bg-gold/20 border-gold text-gold"
                        : "bg-brown/50 border-gold/30 text-gold/50"
                  }
                `}
              >
                {state === "complete" ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </motion.div>

              {/* Step label */}
              <span
                className={`
                  mt-2 text-xs font-medium transition-colors
                  ${state === "complete" ? "text-gold" : state === "active" ? "text-gold" : "text-gold/50"}
                `}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// Simplified version for smaller spaces
export const BlitzProgressCompact = ({ currentStep, completedSteps, className = "" }: BlitzProgressProps) => {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const totalSteps = STEPS.length;
  const completedCount = completedSteps.length;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex gap-1">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;

          return (
            <motion.div
              key={step.id}
              className={`
                w-2 h-2 rounded-full transition-colors
                ${isCompleted ? "bg-gold" : isCurrent ? "bg-gold/60" : "bg-gold/20"}
              `}
              initial={{ scale: 0.8 }}
              animate={{ scale: isCurrent ? 1.2 : 1 }}
              transition={{ duration: 0.2 }}
            />
          );
        })}
      </div>
      <span className="text-xs text-gold/70">
        {completedCount}/{totalSteps}
      </span>
    </div>
  );
};
