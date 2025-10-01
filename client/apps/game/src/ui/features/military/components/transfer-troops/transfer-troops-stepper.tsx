import { Check } from "lucide-react";

export type StepStatus = "pending" | "current" | "complete";

export interface TransferStep {
  title: string;
  description: string;
  status: StepStatus;
}

interface TransferTroopsStepperProps {
  steps: readonly TransferStep[];
}

export const TransferTroopsStepper = ({ steps }: TransferTroopsStepperProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {steps.map((step, index) => {
        const isComplete = step.status === "complete";
        const isCurrent = step.status === "current";

        return (
          <div
            key={step.title}
            className={`flex flex-1 items-start gap-3 rounded-md border p-3 transition-colors ${
              isComplete
                ? "border-gold/50 bg-gold/10"
                : isCurrent
                  ? "border-gold bg-dark-brown/80"
                  : "border-gold/20 bg-dark-brown/50"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                isComplete
                  ? "border-gold bg-gold text-dark-brown"
                  : isCurrent
                    ? "border-gold text-gold"
                    : "border-gold/30 text-gold/60"
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gold">{step.title}</span>
              <span className="text-xs text-gold/70">{step.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
