import type {
  CosmeticMetadata,
  CosmeticMetadataAttribute,
} from "../lib/use-torii-cosmetics";

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  modelPath: string;
  metadata?: CosmeticMetadata | null;
  tokenSymbol?: string;
  balance?: string;
  attributes?: CosmeticMetadataAttribute[];
  image?: string | null;
  tokenId?: string | null;
  slot?: string | null;
}

/**
 * Temporary curated list for the grid; replace with indexer-backed data when available.
 */
export const COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: "legacy-paladin",
    name: "Winter Lord Paladin",
    description: "Primary legendary armor set with frost-forged plate and radiant banners.",
    modelPath: "/models/cosmetics/high-res/winter_lord_paladin_primary.glb",
  },
  {
    id: "legacy-paladin-secondary",
    name: "Winter Lord Regalia",
    description: "Secondary stance showcasing the paladin's cape sweep and aura emitters.",
    modelPath: "/models/cosmetics/high-res/winter_lord_paladin_secondary.glb",
  },
  {
    id: "winter-spike-aura",
    name: "Spike Aura",
    description: "Icy particle aura that wraps units in crystallised shards during deployment.",
    modelPath: "/models/cosmetics/high-res/winter_lord_spike_aura.glb",
  },
  {
    id: "legacy-realm-aura",
    name: "Realm Aura",
    description: "Season one realm perimeter cosmetic with sweeping light arcs.",
    modelPath: "/models/cosmetics/high-res/s1_legacy_realm_aura.glb",
  },
  {
    id: "legacy-troop-aura",
    name: "Troop Aura",
    description: "Legacy troop aura that highlights squads with heritage sigils.",
    modelPath: "/models/cosmetics/high-res/s1_legacy_troop_aura.glb",
  },
  {
    id: "castle-s1",
    name: "Season One Keep",
    description: "Castle cosmetic featuring the level two seasonal crest and light rig.",
    modelPath: "/models/cosmetics/high-res/castle_s1_lvl2.glb",
  },
  {
    id: "castle-winter-l3",
    name: "Winter Lord Castle",
    description: "High-tier castle skin with snowpack, frost lanterns, and plume animations.",
    modelPath: "/models/cosmetics/high-res/castle_winter_lord_l3.glb",
  },
  {
    id: "common-platform",
    name: "Common Platform",
    description: "Pedestal base for weapon cosmetics, used to preview props in 3D.",
    modelPath: "/models/cosmetics/high-res/common_platform.glb",
  },
  {
    id: "common-quiver",
    name: "Hunter's Quiver",
    description: "Common-tier back cosmetic with animated fletching details.",
    modelPath: "/models/cosmetics/high-res/common_quiver.glb",
  },
  {
    id: "bow-common",
    name: "Common Bow",
    description: "Baseline ranged weapon cosmetic with polished wood textures.",
    modelPath: "/models/cosmetics/high-res/bow_common.glb",
  },
  {
    id: "legacy-knight",
    name: "Legacy Knight T3",
    description: "Tier three knight armor referencing the legacy season palette.",
    modelPath: "/models/cosmetics/high-res/legacy_knight_t3.glb",
  },
];
