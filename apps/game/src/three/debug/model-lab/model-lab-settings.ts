import type { SailPrint } from "../../characters/ships/ship-sail-print";
import type { ShipArmyClass, ShipTier } from "../../characters/ships/ship-design";

export interface ModelLabSettings {
  family: "ships" | ShipArmyClass;
  army: ShipArmyClass;
  source: "study" | "current" | "default" | "legacy";
  tier: ShipTier;
  compare: boolean;
  action: "idle" | "move";
  sailColor: string;
  sailPrint: SailPrint;
  wind: number;
  camera: "orbit" | "rts" | "side" | "top";
  biome: "grassland" | "forest" | "desert" | "snow" | "tropical";
  lighting: "day" | "sunset";
  wireframe: boolean;
  speed: number;
}

export function readModelLabSettings(params: URLSearchParams): ModelLabSettings {
  const family = choice(params.get("family"), ["ships", "knight", "crossbowman", "paladin"] as const, "ships");
  const requestedSource = choice(params.get("source"), ["study", "current", "default", "legacy"] as const, "study");
  const source = family !== "ships" && requestedSource === "study" ? "current" : requestedSource;
  const action = choice(params.get("action"), ["idle", "move"] as const, "idle");
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
    biome: choice(params.get("biome"), ["grassland", "forest", "desert", "snow", "tropical"] as const, "grassland"),
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

function choice<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}
