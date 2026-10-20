import { HudButton, HudField, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { CombatParameters, CombatSimulator } from "@bibliothecadao/eternum";

interface CombatParametersPanelProps {
  parameters: CombatParameters;
  onParametersChange: (parameters: CombatParameters) => void;
  show: boolean;
}

/** A parameter's key as a label: "damageScaling" reads "Damage Scaling". */
const parameterLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

/**
 * Advanced combat parameters (toggled with Ctrl+Shift+S). Rendered INSIDE the
 * modal shell node (`.modal-no-drag` + stopPropagation) so interacting with it
 * never triggers the shell's click-outside dismissal.
 */
export const CombatParametersPanel = ({ parameters, onParametersChange, show }: CombatParametersPanelProps) => {
  if (!show) return null;

  return (
    <div
      className="modal-no-drag absolute right-3 top-3 z-50 max-h-full w-80 overflow-y-auto"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <HudPanel title="Combat Parameters" collapsible={false}>
        <div className="space-y-2">
          {Object.entries(parameters).map(([key, value]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-hud-label text-hud-muted">{parameterLabel(key)}</span>
              <HudField
                type="number"
                aria-label={parameterLabel(key)}
                value={String(Number(value))}
                onChange={(text) => {
                  const next = parseFloat(text);
                  if (!Number.isNaN(next)) onParametersChange({ ...parameters, [key]: next });
                }}
                min={0}
                max={1000}
                step={0.01}
              />
            </label>
          ))}
          <div className="grid pt-2">
            <HudButton kind="secondary" onClick={() => onParametersChange(CombatSimulator.getDefaultParameters())}>
              Reset to defaults
            </HudButton>
          </div>
        </div>
      </HudPanel>
    </div>
  );
};
