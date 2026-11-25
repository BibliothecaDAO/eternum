import type { AspectId } from "@bibliothecadao/types";
import { modelPath } from "../utils/model-url";
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
}

const ASPECT_SLUGS = {
  1: "prowess",
  2: "luminary",
  3: "havoc",
  4: "insight",
} as const satisfies Record<AspectId, string>;

const ASPECT_WONDER_LIST: readonly RealmAssetEntry[] = (Object.entries(ASPECT_SLUGS) as [string, string][]).map(
  ([key, slug]) => {
    const aspect = Number(key) as AspectId;
    return {
      id: `wonder-${slug}`,
      label: `Aspect Wonder · ${slug[0].toUpperCase()}${slug.slice(1)}`,
      level: 3,
      wonder: true,
      aspect,
      path: modelPath(`realms/wonder-${slug}.glb`),
    };
  },
);

export const ASPECT_WONDER_PATHS = ASPECT_WONDER_LIST.map((asset) => asset.path);

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
];
export const REALM_ASSETS: readonly RealmAssetEntry[] = [...assets, ...ASPECT_WONDER_LIST];
export const REALM_PATHS = REALM_ASSETS.map((asset) => asset.path);

/** Structure levels stay zero-based; only the presentation of a wonder changes. */
export function realmModelIndex(
  level: number,
  wonder: boolean,
  entityId: string | number | bigint,
  aspect?: AspectId | null,
): number {
  if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error(`Unknown realm level ${level}`);
  if (!wonder) return level;
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
