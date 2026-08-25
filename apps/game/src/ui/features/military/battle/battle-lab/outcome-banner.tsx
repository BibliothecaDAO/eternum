import { cn } from "@/ui/design-system/atoms/lib/utils";

export type BattleOutcome = "Victory" | "Defeat" | "Draw";

const COPY: Record<BattleOutcome, { label: string; className: string }> = {
  Victory: {
    label: "Victory — the enemy is wiped out",
    className: "border-emerald-400/40 bg-emerald-900/25 text-emerald-200",
  },
  Defeat: { label: "Defeat — your force is wiped out", className: "border-red-400/40 bg-red-900/25 text-red-200" },
  Draw: {
    label: "Both armies survive — no decisive result",
    className: "border-amber-400/40 bg-amber-900/20 text-amber-200",
  },
};

export const OutcomeBanner = ({ outcome }: { outcome: BattleOutcome }) => {
  const { label, className } = COPY[outcome];
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2.5 text-center text-sm font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </div>
  );
};
