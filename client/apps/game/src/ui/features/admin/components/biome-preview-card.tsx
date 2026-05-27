import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useMemo } from "react";
import { FELT_CENTER } from "@/ui/config";
import {
  buildBiomePreviewClimate,
  buildBiomePreviewModel,
  type FactoryBiomeClimateValues,
} from "../services/biome-preview";

export type BiomeClimateOverrideField =
  | "elevationScaleBps"
  | "moistureScaleBps"
  | "elevationBiasBps"
  | "moistureBiasBps"
  | "elevationSeed"
  | "moistureSeed";

type BiomeClimateOverrides = Partial<Record<BiomeClimateOverrideField, string>>;

interface BiomePreviewCardProps {
  baseClimate?: FactoryBiomeClimateValues;
  overrides: BiomeClimateOverrides;
  onChange: (field: BiomeClimateOverrideField, value: string) => void;
  onRandomizeSeeds: () => void;
  onReset: () => void;
}

const PREVIEW_SIZE = 21;
const PREVIEW_CENTER = 0;

const BIOME_CLIMATE_FIELDS: Array<{
  field: BiomeClimateOverrideField;
  label: string;
  fallback: number;
  max?: number;
}> = [
  { field: "elevationScaleBps", label: "Elevation Scale BPS", fallback: 10000, max: 65535 },
  { field: "moistureScaleBps", label: "Moisture Scale BPS", fallback: 10000, max: 65535 },
  { field: "elevationBiasBps", label: "Elevation Bias BPS", fallback: 10000, max: 65535 },
  { field: "moistureBiasBps", label: "Moisture Bias BPS", fallback: 10000, max: 65535 },
  { field: "elevationSeed", label: "Elevation Seed", fallback: 0, max: 4294967295 },
  { field: "moistureSeed", label: "Moisture Seed", fallback: 0, max: 4294967295 },
];

const getBaseClimateValue = (baseClimate: FactoryBiomeClimateValues | undefined, field: BiomeClimateOverrideField) =>
  baseClimate?.[field] ?? BIOME_CLIMATE_FIELDS.find((control) => control.field === field)?.fallback ?? 0;

export const BiomePreviewCard = ({
  baseClimate,
  overrides,
  onChange,
  onRandomizeSeeds,
  onReset,
}: BiomePreviewCardProps) => {
  const previewClimate = useMemo(
    () =>
      buildBiomePreviewClimate({
        baseClimate,
        overrides,
      }),
    [baseClimate, overrides],
  );
  const previewMapCenter = FELT_CENTER();
  const preview = useMemo(
    () =>
      buildBiomePreviewModel({
        climate: previewClimate,
        size: PREVIEW_SIZE,
        center: PREVIEW_CENTER,
        mapCenter: previewMapCenter,
      }),
    [previewClimate, previewMapCenter],
  );

  return (
    <div className="space-y-4 rounded-md border border-gold/20 bg-black/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gold">Biome Preview</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRandomizeSeeds}
            className="inline-flex items-center gap-2 rounded border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Randomize Seeds
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded border border-gold/20 bg-black/30 px-3 py-2 text-xs font-semibold text-gold/80 hover:bg-gold/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div
          className="grid aspect-square overflow-hidden rounded border border-gold/20 bg-black/50"
          style={{ gridTemplateColumns: `repeat(${PREVIEW_SIZE}, minmax(0, 1fr))` }}
        >
          {preview.tiles.map((tile) => (
            <div
              key={tile.key}
              title={`${tile.biome} (${tile.col}, ${tile.row})`}
              style={{ backgroundColor: tile.color }}
            />
          ))}
        </div>

        <div className="space-y-2">
          {preview.distribution.slice(0, 8).map((entry) => (
            <div key={entry.biome} className="flex items-center justify-between gap-3 text-xs text-gold/70">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.biome}</span>
              </div>
              <span className="font-mono text-gold/80">{entry.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {BIOME_CLIMATE_FIELDS.map((control) => (
          <div key={control.field} className="space-y-1">
            <label className="text-xs font-semibold text-gold/70">{control.label}</label>
            <input
              type="number"
              min={0}
              max={control.max}
              step={1}
              placeholder={String(getBaseClimateValue(baseClimate, control.field))}
              value={overrides[control.field] ?? String(getBaseClimateValue(baseClimate, control.field))}
              onChange={(event) => onChange(control.field, event.target.value)}
              className="w-full rounded-md border border-gold/20 bg-black/40 px-3 py-2 font-mono text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
