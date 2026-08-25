import type { CosmeticMetadata, CosmeticMetadataAttribute } from "../lib/use-torii-cosmetics";

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
  /** Number of this cosmetic type owned (when grouped) */
  count?: number;
  /** Raw attribute key used for grouping */
  attributesRaw?: string;
}

/**
 * Temporary curated list for the grid; replace with indexer-backed data when available.
 * File names use attributesRaw hex values (e.g., 0x305020701.glb).
 */
export const COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: "legacy-paladin",
    name: "Winter Lord Paladin",
    description: "Primary legendary armor set with frost-forged plate and radiant banners.",
    modelPath: "/models/cosmetics/low-res/0x305020701.glb",
    attributesRaw: "0x305020701",
  },
  {
    id: "legacy-paladin-secondary",
    name: "Winter Lord Regalia",
    description: "Secondary stance showcasing the paladin's cape sweep and aura emitters.",
    modelPath: "/models/cosmetics/low-res/0x306020801.glb",
    attributesRaw: "0x306020801",
  },
  {
    id: "winter-spike-aura",
    name: "Spike Aura",
    description: "Icy particle aura that wraps units in crystallised shards during deployment.",
    modelPath: "/models/cosmetics/low-res/0x2030601.glb",
    attributesRaw: "0x2030601",
  },
  {
    id: "legacy-realm-aura",
    name: "Realm Aura",
    description: "Season one realm perimeter cosmetic with sweeping light arcs.",
    modelPath: "/models/cosmetics/low-res/0x2040401.glb",
    attributesRaw: "0x2040401",
  },
  {
    id: "legacy-troop-aura",
    name: "Troop Aura",
    description: "Legacy troop aura that highlights squads with heritage sigils.",
    modelPath: "/models/cosmetics/low-res/0x4050301.glb",
    attributesRaw: "0x4050301",
  },
  {
    id: "castle-s1",
    name: "Season One Keep",
    description: "Castle cosmetic featuring the level two seasonal crest and light rig.",
    modelPath: "/models/cosmetics/low-res/0x3040101.glb",
    attributesRaw: "0x3040101",
  },
  {
    id: "castle-winter-l3",
    name: "Winter Lord Castle",
    description: "High-tier castle skin with snowpack, frost lanterns, and plume animations.",
    modelPath: "/models/cosmetics/low-res/0x3030501.glb",
    attributesRaw: "0x3030501",
  },
  {
    id: "common-platform",
    name: "Common Platform",
    description: "Pedestal base for weapon cosmetics, used to preview props in 3D.",
    modelPath: "/models/cosmetics/low-res/0x8010b01.glb",
    attributesRaw: "0x8010b01",
  },
  {
    id: "common-quiver",
    name: "Hunter's Quiver",
    description: "Common-tier back cosmetic with animated fletching details.",
    modelPath: "/models/cosmetics/low-res/0x206010a01.glb",
    attributesRaw: "0x206010a01",
  },
  {
    id: "bow-common",
    name: "Common Bow",
    description: "Baseline ranged weapon cosmetic with polished wood textures.",
    modelPath: "/models/cosmetics/low-res/0x205010901.glb",
    attributesRaw: "0x205010901",
  },
  {
    id: "legacy-knight",
    name: "Legacy Knight T3",
    description: "Tier three knight armor referencing the legacy season palette.",
    modelPath: "/models/cosmetics/low-res/0x107050201.glb",
    attributesRaw: "0x107050201",
  },
  {
    id: "legacy-hunter",
    name: "Legacy Hunter",
    description: "Season one crossbowman armor with intricate leather detailing.",
    modelPath: "/models/cosmetics/low-res/0x207050c01.glb",
    attributesRaw: "0x207050c01",
  },
  {
    id: "overgrown-foundation",
    name: "Overgrown Foundation",
    description: "Nature-reclaimed troop base with moss and vine overgrowth.",
    modelPath: "/models/cosmetics/low-res/0x8040e01.glb",
    attributesRaw: "0x8040e01",
  },
  {
    id: "winter-vortex",
    name: "Winter Vortex",
    description: "Swirling frost aura that envelops troops in icy winds.",
    modelPath: "/models/cosmetics/low-res/0x4030f01.glb",
    attributesRaw: "0x4030f01",
  },
  {
    id: "winters-footing",
    name: "Winter's Footing",
    description: "Frozen troop base with crystalline ice formations.",
    modelPath: "/models/cosmetics/low-res/0x8031001.glb",
    attributesRaw: "0x8031001",
  },
  {
    id: "overgrown-nest",
    name: "Overgrown Nest",
    description: "Ancient realm skin reclaimed by dense forest growth.",
    modelPath: "/models/cosmetics/low-res/0x3021101.glb",
    attributesRaw: "0x3021101",
  },
  {
    id: "winter-trooper-broadaxe",
    name: "Winter Trooper's Broadaxe",
    description: "Frost-tempered primary weapon for elite winter knights.",
    modelPath: "/models/cosmetics/low-res/0x105021201.glb",
    attributesRaw: "0x105021201",
  },
  {
    id: "winter-trooper-targe",
    name: "Winter Trooper's Targe",
    description: "Reinforced secondary shield bearing winter clan insignia.",
    modelPath: "/models/cosmetics/low-res/0x106021301.glb",
    attributesRaw: "0x106021301",
  },
  {
    id: "witness-morning-wars",
    name: "Witness of the Morning Wars",
    description: "Ancient legendary armor imbued with dawn's first light.",
    modelPath: "/models/cosmetics/low-res/0x1011401.glb",
    attributesRaw: "0x1011401",
  },
  {
    id: "light-cavalry-shield",
    name: "Light Cavalry Shield",
    description: "Agile secondary shield designed for mounted combat.",
    modelPath: "/models/cosmetics/low-res/0x306011601.glb",
    attributesRaw: "0x306011601",
  },
];
