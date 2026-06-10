import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { CombatParameters, CombatSimulator } from "@bibliothecadao/eternum";

interface CombatParametersPanelProps {
  parameters: CombatParameters;
  onParametersChange: (parameters: CombatParameters) => void;
  show: boolean;
}

/**
 * Advanced combat parameters (toggled with Ctrl+Shift+S). Rendered INSIDE the
 * modal shell node (`.modal-no-drag` + stopPropagation) so interacting with it
 * never triggers the shell's click-outside dismissal.
 */
export const CombatParametersPanel = ({ parameters, onParametersChange, show }: CombatParametersPanelProps) => {
  if (!show) return null;

  return (
    <div
      className={cn(
        "modal-no-drag absolute right-3 top-3 z-50 max-h-[80%] w-80 overflow-y-auto rounded-xl p-4",
        OVERLAY_SURFACE_BASE,
      )}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
        <span className={HUD_LABEL_BRIGHT}>Combat Parameters</span>
      </div>
      <div className="space-y-2">
        {Object.entries(parameters).map(([key, value]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-gold/60">
              {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
            </span>
            <input
              type="number"
              value={Number(value)}
              onChange={(event) => {
                const next = parseFloat(event.target.value);
                if (!Number.isNaN(next)) {
                  onParametersChange({ ...parameters, [key]: next });
                }
              }}
              min={0}
              max={key === "damage_c0" || key === "damage_delta" ? 1_000_000 : 1000}
              step={key === "damage_c0" || key === "damage_delta" ? 1000 : 0.01}
              className="rounded border border-gold/20 bg-black/40 px-2 py-1 text-gold focus:border-gold/40 focus:outline-none"
            />
          </label>
        ))}
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-gold/20 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/30"
          onClick={() => onParametersChange(CombatSimulator.getDefaultParameters())}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
