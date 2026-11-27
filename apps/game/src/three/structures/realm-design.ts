import { REALM_SKIN_FAMILIES } from "@bibliothecadao/eternum";
import { rankName, type AspectId } from "@bibliothecadao/types";
import { BASE_REALM_ASSETS } from "./base-realm-kit";
import { SEASON_ONE_REALM_KIT_LEVELS, aspectWonderKitPath, seasonOneRealmKitPath } from "./realm-kit";

interface RealmAssetEntry {
  id: string;
  label: string;
  level: number;
  wonder: boolean;
  path: string;
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

export const ASPECT_WONDER_KIT_ASSETS: readonly RealmAssetEntry[] = SEASON_ONE_REALM_KIT_LEVELS.flatMap((level) =>
  (Object.entries(ASPECT_SLUGS) as [string, string][]).map(([key, slug]) => {
    const aspect = Number(key) as AspectId;
    return {
      id: `wonder-${slug}-${level}`,
      label: `Aspect Wonder · ${aspectTitle(slug)} · ${rankName(level)}`,
      level,
      wonder: true,
      aspect,
      path: aspectWonderKitPath(aspect, level),
    };
  }),
);

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

export const REALM_ASSETS: readonly RealmAssetEntry[] = [
  ...BASE_REALM_ASSETS,
  ...ASPECT_WONDER_KIT_ASSETS,
  ...SEASON_ONE_REALM_ASSETS,
];
export const REALM_PATHS = REALM_ASSETS.map((asset) => asset.path);

export function realmModelIndex(
  level: number,
  wonder: boolean,
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
    const kitId = `wonder-${ASPECT_SLUGS[aspect]}-${level}`;
    const kitIndex = REALM_ASSETS.findIndex((asset) => asset.id === kitId);
    if (kitIndex < 0) throw new Error(`Missing aspect wonder kit ${kitId}`);
    return kitIndex;
  }
  return level;
}

export function isWonderModelPath(path: string): boolean {
  return REALM_ASSETS.some((asset) => asset.wonder && asset.path === path);
}
