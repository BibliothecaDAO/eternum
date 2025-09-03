import { TroopType } from "@bibliothecadao/types";

// Enums for asset types
export enum AssetType {
  TroopArmor = "Troop Armor",
  TroopPrimary = "Troop Primary",
  TroopSecondary = "Troop Secondary",
  TroopAura = "Troop Aura",
  TroopBase = "Troop Base",
  RealmSkin = "Realm Skin",
  RealmAura = "Realm Aura",
}

enum AssetSet {
  FirstLegacySet = "First Legacy Set",
  WinterLordSet = "Winter Lord Set",
  S1HunterSet = "S1 Hunter Set",
  S1AlternatesSet = "",
}

export enum AssetRarity {
  Legendary = "legendary",
  Epic = "epic",
  Rare = "rare",
  Uncommon = "uncommon",
  Common = "common",
}

export interface ChestAsset {
  id: string;
  name: string;
  type: AssetType;
  troopType: TroopType | undefined;
  rarity: AssetRarity;
  set: AssetSet;
  attributesRaw: string;
  description: string;
  drawChance: number;
  modelPath: string;
  imagePath: string;
  positionY: number;
  scale: number;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  cameraPosition?: { x: number; y: number; z: number };
}

// Base model path
const modelPath = "models/cosmetics/low-res";

// Cosmetic names mapping for display purposes
export const COSMETIC_NAMES = [
  { id: "1", name: "Legacy Keep", epoch: "Season 1" },
  { id: "2", name: "Legacy Guardian", epoch: "Season 1" },
  { id: "3", name: "Aura of the Legacy Warrior", epoch: "Season 1" },
  { id: "4", name: "Aura of the Legacy Realm", epoch: "Season 1" },
  { id: "5", name: "Winterhold", epoch: "Season 1" },
  { id: "6", name: "Winter's Palisade", epoch: "Season 1" },
  { id: "7", name: "Winter Rider's Battleaxe", epoch: "Season 1" },
  { id: "8", name: "Winter Rider's Shield", epoch: "Season 1" },
  { id: "9", name: "Hunter's Bow", epoch: "Season 1" },
  { id: "10", name: "Hunter's Quiver", epoch: "Season 1" },
  { id: "11", name: "Carved Wooden Base", epoch: "Season 1" },
];

export const chestAssets: ChestAsset[] = [
  {
    id: "4",
    name: COSMETIC_NAMES.find((c) => c.id === "4")?.name || "",
    type: AssetType.RealmAura,
    troopType: undefined,
    rarity: AssetRarity.Epic,
    set: AssetSet.FirstLegacySet,
    description: "An aura of golden magnificence for a distinguished Realm.",
    drawChance: 4.22,
    modelPath: `${modelPath}/s1_legacy_realm_aura.glb`,
    imagePath: "images/cosmetics/legacy-realm-aura.png",
    positionY: -0.3,
    scale: 2.4,
    cameraPosition: { x: 0, y: 1.3, z: 1 },
    attributesRaw: "0x4050301",
  },
  {
    id: "5",
    name: COSMETIC_NAMES.find((c) => c.id === "5")?.name || "",
    type: AssetType.RealmSkin,
    troopType: undefined,
    rarity: AssetRarity.Rare,
    set: AssetSet.WinterLordSet,
    description: "The icy domain of a Lord that has withstood the fiercest of winters.",
    drawChance: 8.45,
    modelPath: `${modelPath}/castle_winter_lord_l3.glb`,
    imagePath: "images/cosmetics/winter-lord-realm.png",
    positionY: 0,
    scale: 1,
    rotationY: 1.2,
    rotationX: 0,
    cameraPosition: { x: 0, y: 1, z: 1 },
    attributesRaw: "0x3030501",
  },
  {
    id: "6",
    name: COSMETIC_NAMES.find((c) => c.id === "6")?.name || "",
    type: AssetType.RealmAura,
    troopType: undefined,
    rarity: AssetRarity.Rare,
    set: AssetSet.WinterLordSet,
    description: "A ring of razor-sharp ice spikes to deter a Lord's foes.",
    drawChance: 8.45,
    modelPath: `${modelPath}/winter_lord_spike_aura.glb`,
    imagePath: "images/cosmetics/winter-lord-realm-aura.png",
    positionY: 0.2,
    scale: 1,
    attributesRaw: "0x2030601",
  },
  {
    id: "3",
    name: COSMETIC_NAMES.find((c) => c.id === "3")?.name || "",
    type: AssetType.TroopAura,
    troopType: undefined,
    rarity: AssetRarity.Legendary,
    set: AssetSet.FirstLegacySet,
    description: "An aura of golden magnificence for troops of a distinguished Realm.",
    drawChance: 1.41,
    modelPath: `${modelPath}/s1_legacy_troop_aura.glb`,
    imagePath: "images/cosmetics/legacy-troop-aura.png",
    positionY: 0,
    scale: 0.7,
    rotationY: 0,
    // cameraPosition: { x: 0, y: 1.3, z: 1 },
    attributesRaw: "0x2040401",
  },
  {
    id: "2",
    name: COSMETIC_NAMES.find((c) => c.id === "2")?.name || "",
    type: AssetType.TroopArmor,
    troopType: TroopType.Knight,
    rarity: AssetRarity.Legendary,
    set: AssetSet.FirstLegacySet,
    description:
      "An impressive and timeless Knight armor set, inspired by the Knight troop models of Eternum Season 1.",
    drawChance: 1.41,
    modelPath: `${modelPath}/legacy_knight_t3.glb`,
    imagePath: "images/cosmetics/legacy-knight.png",
    positionY: 0.2,
    scale: 1,
    rotationY: 0.7,
    rotationX: 0,
    cameraPosition: { x: 0, y: 1.3, z: 1 },
    attributesRaw: "0x107050201",
  },
  {
    id: "7",
    name: COSMETIC_NAMES.find((c) => c.id === "7")?.name || "",
    type: AssetType.TroopPrimary,
    troopType: TroopType.Paladin,
    rarity: AssetRarity.Uncommon,
    set: AssetSet.WinterLordSet,
    description: "A frosty, spiked battleaxe wielded by Winter Paladins.",
    drawChance: 12.68,
    modelPath: `${modelPath}/winter_lord_paladin_primary.glb`,
    imagePath: "images/cosmetics/winter-lord-paladin-axe.png",
    positionY: 0.5,
    scale: 1,
    rotationY: -1.5,
    attributesRaw: "0x305020701",
  },
  {
    id: "8",
    name: COSMETIC_NAMES.find((c) => c.id === "8")?.name || "",
    type: AssetType.TroopSecondary,
    troopType: TroopType.Paladin,
    rarity: AssetRarity.Uncommon,
    set: AssetSet.WinterLordSet,
    description: "An elegant, snowflake-patterned cavalry shield wielded by Winter Paladins.",
    drawChance: 12.68,
    modelPath: `${modelPath}/winter_lord_paladin_secondary.glb`,
    imagePath: "images/cosmetics/winter-lord-paladin-shield.png",
    positionY: 0.5,
    scale: 1,
    rotationY: -1.5,
    attributesRaw: "0x306020801",
  },
  {
    id: "9",
    name: COSMETIC_NAMES.find((c) => c.id === "9")?.name || "",
    type: AssetType.TroopPrimary,
    troopType: TroopType.Crossbowman,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A wooden hunting bow.",
    drawChance: 16.9,
    modelPath: `${modelPath}/bow_common.glb`,
    imagePath: "images/cosmetics/common-bow.png",
    positionY: 0.5,
    scale: 0.9,
    rotationY: 0,
    rotationX: 0,
    rotationZ: 0,
    attributesRaw: "0x205010901",
  },
  {
    id: "10",
    name: COSMETIC_NAMES.find((c) => c.id === "10")?.name || "",
    type: AssetType.TroopSecondary,
    troopType: TroopType.Crossbowman,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A leather quiver filled with hunting arrows.",
    drawChance: 16.9,
    modelPath: `${modelPath}/common_quiver.glb`,
    imagePath: "images/cosmetics/common-quiver.png",
    positionY: 0,
    scale: 0.6,
    rotationX: 0,
    rotationZ: -0.8,
    attributesRaw: "0x206010a01",
  },
  {
    id: "11",
    name: COSMETIC_NAMES.find((c) => c.id === "11")?.name || "",
    type: AssetType.TroopBase,
    troopType: undefined,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A basic-but-sturdy wooden platform.",
    drawChance: 16.9,
    modelPath: `${modelPath}/common_platform.glb`,
    imagePath: "images/cosmetics/common-base.png",
    positionY: 0.5,
    scale: 0.7,
    attributesRaw: "0x8010b01",
  },
];

// Centralized rarity styling configuration
export const RARITY_STYLES = {
  common: {
    text: "text-rarity-common",
    bg: "bg-rarity-common",
    border: "border-rarity-common",
    glow: "border-2 border-rarity-common bg-rarity-common/15 shadow-[0_0_15px_rgba(132,132,132,0.4)]",
    hex: "#848484",
  },
  uncommon: {
    text: "text-rarity-uncommon",
    bg: "bg-rarity-uncommon",
    border: "border-rarity-uncommon",
    glow: "border-2 border-rarity-uncommon bg-rarity-uncommon/20 shadow-[0_0_18px_rgba(108,201,94,0.5)]",
    hex: "#6cc95e",
  },
  rare: {
    text: "text-rarity-rare",
    bg: "bg-rarity-rare",
    border: "border-rarity-rare",
    glow: "border-2 border-rarity-rare bg-rarity-rare/20 shadow-[0_0_22px_rgba(86,200,218,0.6)]",
    hex: "#56c8da",
  },
  epic: {
    text: "text-rarity-epic",
    bg: "bg-rarity-epic",
    border: "border-rarity-epic",
    glow: "border-2 border-rarity-epic bg-rarity-epic/20 shadow-[0_0_28px_rgba(186,55,212,0.6)]",
    hex: "#ba37d4",
  },
  legendary: {
    text: "text-rarity-legendary",
    bg: "bg-rarity-legendary",
    border: "border-rarity-legendary",
    glow: "border-2 border-rarity-legendary bg-rarity-legendary/20 shadow-[0_0_35px_rgba(233,176,98,0.7)]",
    hex: "#e9b062",
  },
} as const;

// Dynamic rarity percentages based on actual chest assets
export const calculateRarityPercentages = (assets: ChestAsset[]) => {
  const totalDrawChance = assets.reduce((sum, asset) => sum + asset.drawChance, 0);

  const rarityTotals = assets.reduce(
    (acc, asset) => {
      acc[asset.rarity] = (acc[asset.rarity] || 0) + asset.drawChance;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    common: Number((((rarityTotals.common || 0) / totalDrawChance) * 100).toFixed(2)),
    uncommon: Number((((rarityTotals.uncommon || 0) / totalDrawChance) * 100).toFixed(2)),
    rare: Number((((rarityTotals.rare || 0) / totalDrawChance) * 100).toFixed(2)),
    epic: Number((((rarityTotals.epic || 0) / totalDrawChance) * 100).toFixed(2)),
    legendary: Number((((rarityTotals.legendary || 0) / totalDrawChance) * 100).toFixed(2)),
  };
};
