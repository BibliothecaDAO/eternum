import { REALM_SKIN_FAMILIES } from "@bibliothecadao/eternum";
import { rankName, type AspectId } from "@bibliothecadao/types";
import { modelPath } from "../utils/model-url";
import { SEASON_ONE_REALM_KIT_LEVELS, seasonOneRealmKitPath } from "./realm-kit";
import { resolveAgeWonderDesign } from "./wonder-design.mjs";
import assets from "./realm-assets.json";

interface RealmAssetEntry {
  id: string;
  label: string;
  level: number;
  wonder: boolean;
  path: string;
  source?: string;
  seed?: number;
  aspect?: AspectId;
  skin?: "season-1";
}

const ASPECT_SLUGS = {
  1: "prowess",
  2: "luminary",
  3: "havoc",
  4: "insight",
} as const satisfies Record<AspectId, string>;

const aspectTitle = (slug: string) => `${slug[0]!.toUpperCase()}${slug.slice(1)}`;

const ASPECT_WONDER_LIST: readonly RealmAssetEntry[] = (Object.entries(ASPECT_SLUGS) as [string, string][]).map(
  ([key, slug]) => {
    const aspect = Number(key) as AspectId;
    return {
      id: `wonder-${slug}`,
      label: `Aspect Wonder · ${aspectTitle(slug)}`,
      level: 3,
      wonder: true,
      aspect,
      path: modelPath(`realms/wonder-${slug}.glb`),
    };
  },
);

export const ASPECT_WONDER_PATHS = ASPECT_WONDER_LIST.map((asset) => asset.path);

export const SEASON_ONE_REALM_ASSETS: readonly RealmAssetEntry[] = SEASON_ONE_REALM_KIT_LEVELS.flatMap((level) =>
  (Object.entries(ASPECT_SLUGS) as [string, string][]).map(([key, slug]) => {
    const aspect = Number(key) as AspectId;
    return {
      id: `season-1-${slug}-${level}`,
      label: `Season 1 · ${aspectTitle(slug)} · ${rankName(level)}`,
      level,
      wonder: false,
      aspect,
      skin: "season-1" as const,
      path: seasonOneRealmKitPath(aspect, level),
    };
  }),
);

export const BASE_REALM_CANDIDATES: readonly RealmAssetEntry[] = [
  {
    id: "base-settlement",
    label: "Base Settlement · thatched hamlet",
    level: 0,
    wonder: false,
    source: "tripo/realms/base-settlement",
    path: modelPath("realms/base-settlement.glb"),
  },
  {
    id: "base-city",
    label: "Base City · courtyard keep",
    level: 1,
    wonder: false,
    source: "tripo/realms/base-city",
    path: modelPath("realms/base-city.glb"),
  },
  {
    id: "base-kingdom",
    label: "Base Kingdom · slate-roofed castle",
    level: 2,
    wonder: false,
    source: "tripo/realms/base-kingdom",
    path: modelPath("realms/base-kingdom.glb"),
  },
  {
    id: "base-empire",
    label: "Base Empire · spired citadel",
    level: 3,
    wonder: false,
    source: "tripo/realms/base-empire",
    path: modelPath("realms/base-empire.glb"),
  },
];
export const REALM_ASSETS: readonly RealmAssetEntry[] = [...assets, ...ASPECT_WONDER_LIST, ...SEASON_ONE_REALM_ASSETS];
export const REALM_PATHS = REALM_ASSETS.map((asset) => asset.path);

export function realmModelIndex(
  level: number,
  wonder: boolean,
  entityId: string | number | bigint,
  aspect?: AspectId | null,
  realmSkin?: number | null,
): number {
  if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error(`Unknown realm level ${level}`);
  if (!wonder) {
    if (realmSkin === REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN && aspect != null) {
      const index = REALM_ASSETS.findIndex(
        (asset) => asset.skin === "season-1" && asset.aspect === aspect && asset.level === level,
      );
      if (index < 0) throw new Error(`Missing Season 1 realm kit for aspect ${aspect} level ${level}`);
      return index;
    }
    return level;
  }
  if (aspect != null) {
    const id = `wonder-${ASPECT_SLUGS[aspect]}`;
    const index = REALM_ASSETS.findIndex((asset) => asset.id === id);
    if (index < 0) throw new Error(`Missing aspect wonder asset for aspect ${aspect}`);
    return index;
  }
  const age = ["settlement", "city", "kingdom", "empire"][level];
  const design = resolveAgeWonderDesign(age, entityId);
  const id = level === 0 ? "standing-stones" : level === 3 ? `sanctum-${design.crown}` : design.crown;
  const index = REALM_ASSETS.findIndex((asset) => asset.id === id && asset.level === level && asset.wonder);
  if (index < 0) throw new Error(`Missing wonder asset ${id} for level ${level}`);
  return index;
}

export function isWonderModelPath(path: string): boolean {
  return REALM_ASSETS.some((asset) => asset.wonder && asset.path === path);
}
