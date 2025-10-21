import { PresetNotFoundError } from "../errors";
import type { GameDeploymentPreset } from "../types";

const presets = new Map<string, GameDeploymentPreset>([
  [
    "minimal",
    {
      id: "minimal",
      description: "Deploys the core Eternum world contract without auxiliary modules.",
      modules: [],
    },
  ],
]);

export const registerPreset = (preset: GameDeploymentPreset) => {
  presets.set(preset.id, preset);
};

export const listPresets = (): GameDeploymentPreset[] => Array.from(presets.values());

export const getPreset = (id: string): GameDeploymentPreset => {
  const preset = presets.get(id);
  if (!preset) {
    throw new PresetNotFoundError(id);
  }
  return preset;
};

export const hasPreset = (id: string): boolean => presets.has(id);

