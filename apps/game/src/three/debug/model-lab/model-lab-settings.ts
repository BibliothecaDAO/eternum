import { BiomeType } from "@bibliothecadao/types";

import { resolveActiveProceduralCharacterReviewCapability } from "../../characters/procedural-character-review-capability";
import type { SailPrint } from "../../characters/ships/ship-sail-print";
import type { ShipArmyClass, ShipTier } from "../../characters/ships/ship-design";

/** Every land biome a unit can stand on; the ids are the lab's URL values. */
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
  "tropical-seasonal-forest": { label: "Tropical seasonal forest", biome: BiomeType.TropicalSeasonalForest },
} as const;

type ModelLabBiomeId = keyof typeof MODEL_LAB_BIOMES;
const MODEL_LAB_BIOME_IDS = Object.keys(MODEL_LAB_BIOMES) as ModelLabBiomeId[];

export interface ModelLabSettings {
  family: "ships" | ShipArmyClass;
  army: ShipArmyClass;
  /** `t1-knight-default`: the runtime knight in the T1 Knight Default skin, offered only under its review flag. */
  source: "study" | "current" | "default" | "legacy" | "t1-knight-default";
  tier: ShipTier;
  compare: boolean;
  /** `run` is for units on foot; ships sail on `move`. */
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
  const requestedSource = choice(
    params.get("source"),
    ["study", "current", "default", "legacy", "t1-knight-default"] as const,
    "study",
  );
  const source = isSourceOffered(requestedSource, family) ? requestedSource : "current";
  const requestedAction = choice(params.get("action"), ["idle", "move", "run"] as const, "idle");
  const action = family === "ships" && requestedAction === "run" ? "move" : requestedAction;
  const speed = Number(params.get("speed") ?? 1);
  return {
    family,
    source,
    army: choice(params.get("army"), ["knight", "crossbowman", "paladin"] as const, "knight"),
    tier: params.get("tier") === "2" ? 2 : params.get("tier") === "3" ? 3 : 1,
    compare: params.get("compare") !== "0",
    action,
    sailColor: /^#[0-9a-f]{6}$/i.test(params.get("sailColor") ?? "") ? params.get("sailColor")! : "#284f80",
    sailPrint: choice(params.get("sailPrint"), ["army", "crown", "chevron", "sun"] as const, "army"),
    wind: Math.max(
      0,
      Math.min(2, Number.isFinite(Number(params.get("wind") ?? 1)) ? Number(params.get("wind") ?? 1) : 1),
    ),
    camera: choice(params.get("camera"), ["orbit", "rts", "side", "top"] as const, "orbit"),
    biome: choice(params.get("biome"), MODEL_LAB_BIOME_IDS, "grassland"),
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

/** The fleet concepts are ships only; the T1 Knight Default is a knight, and only under its review flag. */
export function isSourceOffered(source: ModelLabSettings["source"], family: ModelLabSettings["family"]): boolean {
  if (source === "study") return family === "ships";
  if (source === "t1-knight-default") {
    return family === "knight" && resolveActiveProceduralCharacterReviewCapability().includeT1KnightDefault;
  }
  return true;
}

function choice<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}
