import { BiomeType } from "@bibliothecadao/types";

import type { SailPrint } from "../../characters/ships/ship-sail-print";
import type { ShipArmyClass, ShipTier } from "../../characters/ships/ship-design";

/** Every land biome a unit can stand on. */
export const MODEL_LAB_BIOMES = {
  grassland: { label: "Grassland coast", biome: BiomeType.Grassland },
  forest: { label: "Temperate forest", biome: BiomeType.TemperateDeciduousForest },
  desert: { label: "Desert coast", biome: BiomeType.SubtropicalDesert },
  snow: { label: "Snow coast", biome: BiomeType.Snow },
  tropical: { label: "Tropical forest", biome: BiomeType.TropicalRainForest },
  beach: { label: "Beach", biome: BiomeType.Beach },
  scorched: { label: "Scorched", biome: BiomeType.Scorched },
  bare: { label: "Bare", biome: BiomeType.Bare },
  tundra: { label: "Tundra", biome: BiomeType.Tundra },
  "temperate-desert": { label: "Temperate desert", biome: BiomeType.TemperateDesert },
  shrubland: { label: "Shrubland", biome: BiomeType.Shrubland },
  taiga: { label: "Taiga", biome: BiomeType.Taiga },
  "temperate-rain-forest": { label: "Temperate rain forest", biome: BiomeType.TemperateRainForest },
  "tropical-seasonal-forest": {
    label: "Tropical seasonal forest",
    biome: BiomeType.TropicalSeasonalForest,
  },
} as const;

type ModelLabBiomeId = keyof typeof MODEL_LAB_BIOMES;

export interface ModelLabSettings {
  family: "ships" | ShipArmyClass;
  army: ShipArmyClass;
  source: "study" | "current" | "default" | "comparison";
  tier: ShipTier;
  detail: "hero" | "crowd";
  compare: boolean;
  /** Ships sail on move; foot units can also run. */
  action: "idle" | "move" | "run";
  sailColor: string;
  sailPrint: SailPrint;
  wind: number;
  camera: "orbit" | "rts" | "side" | "top";
  biome: ModelLabBiomeId;
  lighting: "day" | "sunset";
  wireframe: boolean;
  speed: number;
}

export function readModelLabSettings(params: URLSearchParams): ModelLabSettings {
  const family = choice(params.get("family"), ["ships", "knight", "crossbowman", "paladin"] as const, "ships");
  const requestedSource = choice(params.get("source"), ["study", "current", "default", "comparison"] as const, "study");
  const source = isSourceOffered(requestedSource, family) ? requestedSource : "current";
  const action = choice(params.get("action"), listModelLabActions(family), "idle");
  const speed = Number(params.get("speed") ?? 1);
  return {
    family,
    source,
    army: choice(params.get("army"), ["knight", "crossbowman", "paladin"] as const, "knight"),
    tier: params.get("tier") === "2" ? 2 : params.get("tier") === "3" ? 3 : 1,
    compare: source !== "comparison" && params.get("compare") !== "0",
    detail: choice(params.get("detail"), ["hero", "crowd"] as const, "crowd"),
    action,
    sailColor: /^#[0-9a-f]{6}$/i.test(params.get("sailColor") ?? "") ? params.get("sailColor")! : "#284f80",
    sailPrint: choice(params.get("sailPrint"), ["army", "crown", "chevron", "sun"] as const, "army"),
    wind: Math.max(
      0,
      Math.min(2, Number.isFinite(Number(params.get("wind") ?? 1)) ? Number(params.get("wind") ?? 1) : 1),
    ),
    camera: choice(params.get("camera"), ["orbit", "rts", "side", "top"] as const, "orbit"),
    biome: choice(params.get("biome"), listModelLabBiomeIds(), "grassland"),
    lighting: choice(params.get("lighting"), ["day", "sunset"] as const, "day"),
    wireframe: params.get("wireframe") === "1",
    speed: [0.25, 0.5, 1, 1.5, 2].includes(speed) ? speed : 1,
  };
}

export function writeModelLabSettings(settings: ModelLabSettings): URLSearchParams {
  return new URLSearchParams(
    Object.entries(settings).map(([key, value]) => [
      key,
      typeof value === "boolean" ? (value ? "1" : "0") : String(value),
    ]),
  );
}

export function listModelLabBiomeIds(): ModelLabBiomeId[] {
  return Object.keys(MODEL_LAB_BIOMES) as ModelLabBiomeId[];
}

export function listModelLabActions(family: ModelLabSettings["family"]): readonly ModelLabSettings["action"][] {
  return family !== "ships" ? ["idle", "move", "run"] : ["idle", "move"];
}

function isSourceOffered(source: ModelLabSettings["source"], family: ModelLabSettings["family"]): boolean {
  if (source === "comparison") return family === "knight";
  return source !== "study" || family === "ships";
}

function choice<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}
