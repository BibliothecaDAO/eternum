import { HUD_CUE, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";

interface OutcomeStripProps {
  losses: number;
  lossesPercent: number;
  remaining: number;
  total: number;
  staminaBefore: number;
  staminaAfter: number;
}

const formatInt = (value: number) => Math.round(Math.max(0, value)).toLocaleString();

/** Per-side post-fight readout: casualties, remaining bar, stamina change. */
export const OutcomeStrip = ({
  losses,
  lossesPercent,
  remaining,
  total,
  staminaBefore,
  staminaAfter,
}: OutcomeStripProps) => {
  const eliminated = remaining <= 0;
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const barTone = eliminated ? "bg-red-500" : ratio < 0.5 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-gold/15 pt-3">
      <div className="flex items-center justify-between">
        <span className={HUD_LABEL}>Losses</span>
        <span className={cn(HUD_VALUE, "text-red-300")}>
          −{formatInt(losses)} <span className={HUD_CUE}>({Math.round(lossesPercent)}%)</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className={HUD_LABEL}>After</span>
        <span className={cn(HUD_VALUE, eliminated && "text-red-300")}>
          {formatInt(remaining)} <span className={HUD_CUE}>/ {formatInt(total)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-black/40">
        <div className={cn("h-full transition-all", barTone)} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className={HUD_LABEL}>Stamina</span>
        <span className={HUD_VALUE}>
          {Math.round(staminaBefore)} <span className={HUD_CUE}>→</span> {Math.round(Math.max(0, staminaAfter))}
        </span>
      </div>
    </div>
  );
};
