import { motion } from "framer-motion";
import { Check, Globe, Loader2, User, Gamepad2, Play } from "lucide-react";

import type { OnboardingPhase } from "@/hooks/context/use-unified-onboarding";

interface StepIndicatorProps {
  currentPhase: OnboardingPhase;
  isBootstrapRunning: boolean;
}

type Step = {
  id: OnboardingPhase | "complete";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  { id: "world-select", label: "World", icon: Globe },
  { id: "account", label: "Account", icon: User },
  { id: "loading", label: "Setup", icon: Gamepad2 },
  { id: "settlement", label: "Settlement", icon: Play },
];

const getStepStatus = (
  step: Step,
  currentPhase: OnboardingPhase,
  isBootstrapRunning: boolean,
): "complete" | "current" | "pending" | "running" => {
  const phaseOrder: OnboardingPhase[] = ["world-select", "account", "loading", "settlement", "ready"];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const stepIndex = phaseOrder.indexOf(step.id as OnboardingPhase);

  if (stepIndex < currentIndex) {
    return "complete";
  }

  if (stepIndex === currentIndex) {
    // Special case: if we're in account phase but bootstrap is running
    if (currentPhase === "account" && step.id === "loading" && isBootstrapRunning) {
      return "running";
    }
    return "current";
  }

  // Show loading step as running even when in account phase if bootstrap is active
  if (step.id === "loading" && isBootstrapRunning && currentPhase === "account") {
    return "running";
  }

  return "pending";
};

export const StepIndicator = ({ currentPhase, isBootstrapRunning }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-1 py-3 px-2 flex-wrap">
      {STEPS.map((step, index) => {
        const status = getStepStatus(step, currentPhase, isBootstrapRunning);
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all duration-300 ${
                status === "complete"
                  ? "bg-brilliance/20 text-brilliance border border-brilliance/30"
                  : status === "current"
                    ? "bg-gold/20 text-gold border border-gold/50"
                    : status === "running"
                      ? "bg-gold/10 text-gold/70 border border-gold/30"
                      : "bg-white/5 text-white/40 border border-white/10"
              }`}
              initial={false}
              animate={{
                scale: status === "current" ? 1.02 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              {status === "complete" ? (
                <Check className="w-3 h-3" />
              ) : status === "running" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              <span>{step.label}</span>
            </motion.div>

            {index < STEPS.length - 1 && (
              <div
                className={`w-4 h-0.5 mx-0.5 transition-colors duration-300 ${
                  getStepStatus(STEPS[index + 1], currentPhase, isBootstrapRunning) !== "pending"
                    ? "bg-gold/30"
                    : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
