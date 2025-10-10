/**
 * Maps "Epoch Item" attribute values to GLB model paths.
 * Fill in the correct model paths as assets are authored; null values fall back to the default.
 */
export const COSMETIC_MODEL_BY_EPOCH_ITEM: Record<string, string | null> = {
  "1": "/models/cosmetics/high-res/castle_s1_lvl2.glb",
  "2": "/models/cosmetics/high-res/legacy_knight_t3.glb",
  "3": "/models/cosmetics/high-res/s1_legacy_troop_aura.glb",
  "4": "/models/cosmetics/high-res/s1_legacy_realm_aura.glb",
  "5": "/models/cosmetics/high-res/castle_winter_lord_l3.glb",
  "6": "/models/cosmetics/high-res/winter_lord_spike_aura.glb",
  "7": "/models/cosmetics/high-res/winter_lord_paladin_primary.glb",
  "8": "/models/cosmetics/high-res/winter_lord_paladin_secondary.glb",
  "9": "/models/cosmetics/high-res/bow_common.glb",
  "10": "/models/cosmetics/high-res/common_quiver.glb",
  "11": "/models/cosmetics/high-res/common_platform.glb",
};

export const DEFAULT_COSMETIC_MODEL_PATH = "/models/cosmetics/high-res/common_platform.glb";
