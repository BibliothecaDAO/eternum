import type { GamePresetType } from "../../types/game-presets";
import { getPresetsArray } from "../../constants/game-presets";
import { PresetCard } from "./preset-card";

interface PresetSelectionStepProps {
  selectedPreset: GamePresetType | null;
  onSelect: (preset: GamePresetType) => void;
}

export const PresetSelectionStep = ({ selectedPreset, onSelect }: PresetSelectionStepProps) => {
  const presets = getPresetsArray();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gold">Choose Game Type</h2>
        <p className="text-gold/70 mt-2">Select a preset to get started quickly</p>
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={selectedPreset === preset.id}
            onSelect={() => onSelect(preset.id)}
          />
        ))}
      </div>

      {/* Help text */}
      <p className="text-center text-sm text-gold/60">
        Click a preset card above to select it, then customize details in the next step
      </p>
    </div>
  );
};
