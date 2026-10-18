import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudMeter } from "@/ui/design-system/kit/hud-elements";
import { formatAcross, survivalOf, type SideRange } from "../battle-range";

interface OutcomeStripProps {
  side: SideRange;
  total: number;
  staminaBefore: number;
  staminaAfter: number;
}

const formatInt = (value: number) => Math.round(Math.max(0, value)).toLocaleString();

const percentOf = (total: number) => (value: number) => `${Math.round(total > 0 ? (value / total) * 100 : 0)}`;

/** Per-side post-fight readout across the dice: casualties, remaining bar (at the lower count), stamina change. */
export const OutcomeStrip = ({ side, total, staminaBefore, staminaAfter }: OutcomeStripProps) => {
  const eliminated = survivalOf(side) === "Eliminated";
  const remaining = Math.min(side.worst.remaining, side.best.remaining);
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const barTone = eliminated ? "bad" : ratio < 0.5 ? "warn" : "good";

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hud-divider pt-3">
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">Losses</span>
        <span className="text-hud-strong text-hud-bad">
          −{formatAcross(side.worst.losses, side.best.losses, formatInt)}{" "}
          <span className="text-hud-label text-hud-cue">
            ({formatAcross(side.worst.losses, side.best.losses, percentOf(total))}%)
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">After</span>
        <span className={cn("text-hud-strong", eliminated && "text-hud-bad")}>
          {formatAcross(side.worst.remaining, side.best.remaining, formatInt)}{" "}
          <span className="text-hud-label text-hud-cue">/ {formatInt(total)}</span>
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
