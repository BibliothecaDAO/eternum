import { BiomeType } from "@bibliothecadao/types";

import { resolveActiveProceduralCharacterReviewCapability } from "../../characters/procedural-character-review-capability";
import type { SailPrint } from "../../characters/ships/ship-sail-print";
import type { ShipArmyClass, ShipTier } from "../../characters/ships/ship-design";

/**
 * Every land biome a unit can stand on; the ids are the lab's URL values. The public lab offers the first five; the
 * rest arrive with the T1 Knight Default's review flag, so the Knight can be seen on every biome.
 */
export const MODEL_LAB_BIOMES = {
  grassland: { label: "Grassland coast", biome: BiomeType.Grassland, review: false },
  forest: { label: "Temperate forest", biome: BiomeType.TemperateDeciduousForest, review: false },
  desert: { label: "Desert coast", biome: BiomeType.SubtropicalDesert, review: false },
  snow: { label: "Snow coast", biome: BiomeType.Snow, review: false },
  tropical: { label: "Tropical forest", biome: BiomeType.TropicalRainForest, review: false },
  beach: { label: "Beach", biome: BiomeType.Beach, review: true },
  scorched: { label: "Scorched", biome: BiomeType.Scorched, review: true },
  bare: { label: "Bare", biome: BiomeType.Bare, review: true },
  tundra: { label: "Tundra", biome: BiomeType.Tundra, review: true },
  "temperate-desert": { label: "Temperate desert", biome: BiomeType.TemperateDesert, review: true },
  shrubland: { label: "Shrubland", biome: BiomeType.Shrubland, review: true },
  taiga: { label: "Taiga", biome: BiomeType.Taiga, review: true },
  "temperate-rain-forest": { label: "Temperate rain forest", biome: BiomeType.TemperateRainForest, review: true },
  "tropical-seasonal-forest": {
    label: "Tropical seasonal forest",
    biome: BiomeType.TropicalSeasonalForest,
    review: true,
  },
} as const;

type ModelLabBiomeId = keyof typeof MODEL_LAB_BIOMES;

export interface ModelLabSettings {
  family: "ships" | ShipArmyClass;
  army: ShipArmyClass;
  /** `t1-knight-default`: the runtime knight in the T1 Knight Default skin, offered only under its review flag. */
  source: "study" | "current" | "default" | "legacy" | "t1-knight-default";
  tier: ShipTier;
  compare: boolean;
  /** `run` is for units on foot, under the review flag only; ships sail on `move`. */
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
  const action = choice(params.get("action"), listModelLabActions(family), "idle");
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

/** The biomes the lab offers: the public five, or every land biome under the review flag. */
export function listModelLabBiomeIds(): ModelLabBiomeId[] {
  const review = isReviewing();
  return (Object.keys(MODEL_LAB_BIOMES) as ModelLabBiomeId[]).filter((id) => review || !MODEL_LAB_BIOMES[id].review);
}

/** Idle and move for every family; units on foot can also run under the review flag. */
export function listModelLabActions(family: ModelLabSettings["family"]): readonly ModelLabSettings["action"][] {
  return family !== "ships" && isReviewing() ? ["idle", "move", "run"] : ["idle", "move"];
}

/** The fleet concepts are ships only; the T1 Knight Default is a knight, and only under its review flag. */
export function isSourceOffered(source: ModelLabSettings["source"], family: ModelLabSettings["family"]): boolean {
  if (source === "study") return family === "ships";
  if (source === "t1-knight-default") {
    return family === "knight" && isReviewing();
  }
  return true;
}

/** The T1 Knight Default's review flag (development builds with ?t1KnightDefault=1) brings the lab's review options. */
function isReviewing(): boolean {
  return resolveActiveProceduralCharacterReviewCapability().includeT1KnightDefault;
}

function choice<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}
