import { formatPercent, formatExact } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudMeter } from "@/ui/design-system/kit/hud-elements";
import { survivalOf, type SideOutcome } from "../battle-outcome";

interface OutcomeStripProps {
  side: SideOutcome;
  total: number;
  staminaBefore: number;
  staminaAfter: number;
}

const percentOf = (total: number) => (value: number) => formatPercent(total > 0 ? value / total : 0);

/** Per-side post-fight readout across the dice: casualties, remaining bar (at the lower count), stamina change. */
export const OutcomeStrip = ({ side, total, staminaBefore, staminaAfter }: OutcomeStripProps) => {
  const eliminated = survivalOf(side) === "Eliminated";
  const remaining = side.remaining;
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const barTone = eliminated ? "bad" : ratio < 0.5 ? "warn" : "good";

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hud-divider pt-3">
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">Losses</span>
        <span className="text-hud-strong text-hud-bad">
          −{formatExact(side.losses)}{" "}
          <span className="text-hud-label text-hud-cue">({percentOf(total)(side.losses)})</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">After</span>
        <span className={cn("text-hud-strong", eliminated && "text-hud-bad")}>
          {formatExact(side.remaining)}{" "}
          <span className="text-hud-label text-hud-cue">/ {formatExact(Math.max(0, total))}</span>
        </span>
      </div>
      <HudMeter share={ratio} tone={barTone} label="Troops after the fight" />
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">Stamina</span>
        <span className="text-hud-strong">
          {Math.round(staminaBefore)} <span className="text-hud-label text-hud-cue">→</span>{" "}
          {Math.round(Math.max(0, staminaAfter))}
        </span>
      </div>
    </div>
  );
};
