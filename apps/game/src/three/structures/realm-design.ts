import { resolveAgeWonderDesign } from "./wonder-design.mjs";
import assets from "./realm-assets.json";

export const REALM_ASSETS = assets;
export const REALM_PATHS = assets.map((asset) => asset.path);

/** Structure levels stay zero-based; only the presentation of a wonder changes. */
export function realmModelIndex(level: number, wonder: boolean, entityId: string | number | bigint): number {
  if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error(`Unknown realm level ${level}`);
  if (!wonder) return level;
  const age = ["settlement", "city", "kingdom", "empire"][level];
  const design = resolveAgeWonderDesign(age, entityId);
  const id = level === 0 ? "standing-stones" : level === 3 ? `sanctum-${design.crown}` : design.crown;
  const index = assets.findIndex((asset) => asset.id === id && asset.level === level && asset.wonder);
  if (index < 0) throw new Error(`Missing wonder asset ${id} for level ${level}`);
  return index;
}

export function isWonderModelPath(path: string): boolean {
  return assets.some((asset) => asset.wonder && asset.path === path);
}
