import { useState } from "react";
import { WeatherType } from "@/three/managers/weather-manager";
import { WEATHER_SPRITE_SHEETS } from "@/three/effects/weather-sprite-sheet";

export function WeatherLabControls({
  onWeather,
  onStrike,
  onEvolving,
}: {
  onWeather: (type: WeatherType) => void;
  onStrike: () => void;
  onEvolving: (enabled: boolean) => void;
}) {
  const [evolving, setEvolving] = useState(true);
  const [weather, setWeather] = useState(WeatherType.SUNNY);
  return (
    <fieldset
      aria-label="Weather debug controls"
      className="space-y-3 border border-white/15 p-3 text-xs text-stone-300"
    >
      <legend>Weather sprite sheets</legend>
      <label className="flex justify-between">
        Force weather
        <select
          className="bg-stone-900 p-1"
          aria-label="Force weather"
          value={weather}
          onChange={(event) => {
            const type = event.target.value as WeatherType;
            setWeather(type);
            setEvolving(false);
            onWeather(type);
          }}
        >
          {Object.values(WeatherType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={evolving}
          onChange={(event) => {
            setEvolving(event.target.checked);
            onEvolving(event.target.checked);
          }}
        />
        Evolving weather
      </label>
      <button type="button" className="border border-white/20 px-3 py-2" onClick={onStrike}>
        Strike at camera
      </button>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(WEATHER_SPRITE_SHEETS).map(([name, sheet]) => (
          <figure key={name}>
            <img src={sheet.url} alt={`${name} sprite sheet`} className="w-full bg-black/40" />
            <figcaption>
              {name} · {"variants" in sheet ? `${sheet.variants} shapes · ` : ""}
              {sheet.frames} frames · {sheet.frameMs} ms
            </figcaption>
          </figure>
        ))}
      </div>
    </fieldset>
  );
}
