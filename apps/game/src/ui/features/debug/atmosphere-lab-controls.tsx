import { useState } from "react";
import { WORLD_ATMOSPHERE_PRESETS } from "@/three/effects/world-atmosphere-presets";
import { DAY_PHASE_PROGRESS } from "@/utils/cycle-progress";

const PRESET_PROGRESS = {
  deepNight: 0,
  dawn: DAY_PHASE_PROGRESS.dawn,
  morning: DAY_PHASE_PROGRESS.morning,
  day: DAY_PHASE_PROGRESS.afternoon,
  afternoon: DAY_PHASE_PROGRESS.lateAfternoon,
  dusk: DAY_PHASE_PROGRESS.dusk,
  evening: DAY_PHASE_PROGRESS.evening,
};
export function AtmosphereLabControls({
  onPhase,
  onMoon,
}: {
  onPhase: (progress: number) => void;
  onMoon: (enabled: boolean) => void;
}) {
  const [phase, setPhase] = useState<keyof typeof PRESET_PROGRESS>("day");
  const [moon, setMoon] = useState(true);
  const [, refresh] = useState(0);
  const preset = WORLD_ATMOSPHERE_PRESETS[phase];
  return (
    <fieldset className="space-y-3 border border-white/15 p-3 text-xs text-stone-300">
      <legend>Lighting setups</legend>
      <label className="flex justify-between gap-2">
        Phase
        <select
          aria-label="Lighting phase"
          className="bg-stone-900 p-1"
          value={phase}
          onChange={(event) => {
            const next = event.target.value as keyof typeof PRESET_PROGRESS;
            setPhase(next);
            onPhase(PRESET_PROGRESS[next]);
          }}
        >
          {Object.keys(PRESET_PROGRESS).map((key) => (
            <option key={key} value={key}>
              {key === "deepNight" ? "Night" : key[0].toUpperCase() + key.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={moon}
          onChange={(event) => {
            setMoon(event.target.checked);
            onMoon(event.target.checked);
          }}
        />
        Moon
      </label>
      {(["hemisphereIntensity", "ambientIntensity"] as const).map((field) => (
        <label className="flex flex-col gap-1" key={field}>
          {field === "hemisphereIntensity" ? "Hemisphere fill" : "Ambient fill"}: {preset[field].toFixed(2)}
          <input
            aria-label={field === "hemisphereIntensity" ? "Hemisphere fill" : "Ambient fill"}
            type="range"
            min="0.5"
            max="2.5"
            step="0.01"
            value={preset[field]}
            onChange={(event) => {
              preset[field] = Number(event.target.value);
              onPhase(PRESET_PROGRESS[phase]);
              refresh((value) => value + 1);
            }}
          />
        </label>
      ))}
      <p className="text-stone-400">Adjustments use the world preset table for this page session.</p>
    </fieldset>
  );
}
