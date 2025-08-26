import { Card, CardContent } from "@/components/ui/card";
import { useClickSound } from "@/hooks/use-click-sound";
import { TroopType } from "@bibliothecadao/types";
import { BarChart3, Diamond, Swords, Target } from "lucide-react";
import { useState } from "react";
import { ModelViewer } from "./model-viewer";

enum AssetType {
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
  S1AlternatesSet = "",
}

export enum AssetRarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export interface ChestAsset {
  id: string;
  name: string;
  type: AssetType;
  troopType: TroopType | undefined;
  rarity: AssetRarity;
  set: AssetSet;
  description: string;
  drawChance: number;
  modelPath: string;
  imagePath: string;
  positionY: number;
  scale: number;
  rotationY?: number | undefined;
  rotationX?: number | undefined;
  rotationZ?: number | undefined;
  cameraPosition?: { x: number; y: number; z: number } | undefined;
}
// Dynamic rarity percentages based on actual chest assets
const calculateRarityPercentages = (assets: ChestAsset[]) => {
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

// Centralized rarity styling configuration
const RARITY_STYLES = {
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

const modelPath = "models/cosmetics/low-res";

export const chestAssets: ChestAsset[] = [
  {
    id: "4",
    name: "Aura of the Legacy Realm",
    type: AssetType.RealmAura,
    troopType: undefined,
    rarity: AssetRarity.Epic,
    set: AssetSet.FirstLegacySet,
    description: "An aura of golden magnificence for a distinguished Realm.",
    drawChance: 4.22,
    modelPath: `${modelPath}/s1_legacy_realm_aura.glb`,
    imagePath: "images/cosmetics/legacy-realm-aura.png",
    positionY: -0.1,
    scale: 2.4,
    cameraPosition: { x: 0, y: 1.3, z: 1 },
  },
  {
    id: "5",
    name: "Winterhold",
    type: AssetType.RealmSkin,
    troopType: undefined,
    rarity: AssetRarity.Rare,
    set: AssetSet.WinterLordSet,
    description: "The icy domain of a Lord that has withstood the fiercest of winters.",
    drawChance: 8.45,
    modelPath: "models/cosmetics/high-res/castle_winter_lord_l3.glb",
    imagePath: "images/cosmetics/winter-lord-realm.png",
    positionY: 0,
    scale: 1,
    rotationY: 1.2,
    rotationX: 0,
    cameraPosition: { x: 0, y: 1.3, z: 1 },
  },
  {
    id: "6",
    name: "Winter's Palisade",
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
  },
  {
    id: "3",
    name: "Aura of the Legacy Warrior",
    type: AssetType.TroopAura,
    troopType: undefined,
    rarity: AssetRarity.Legendary,
    set: AssetSet.FirstLegacySet,
    description: "An aura of golden magnificence for troops of a distinguished Realm.",
    drawChance: 1.41,
    modelPath: `${modelPath}/s1_legacy_troop_aura.glb`,
    imagePath: "images/cosmetics/legacy-troop-aura.png",
    positionY: 0,
    scale: 1,
    rotationY: -0.1,
    cameraPosition: { x: 0, y: 1.3, z: 1 },
  },
  {
    id: "2",
    name: "Legacy Guardian",
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
  },
  {
    id: "7",
    name: "Battleaxe of the Winter Paladin",
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
  },
  {
    id: "8",
    name: "Shield of the Winter Paladin",
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
  },
  {
    id: "9",
    name: "Hunter's Bow",
    type: AssetType.TroopPrimary,
    troopType: TroopType.Crossbowman,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A wooden hunting bow.",
    drawChance: 16.9,
    modelPath: `${modelPath}/bow_common.glb`,
    imagePath: "images/cosmetics/common-bow.png",
    positionY: -0.8,
    scale: 1,
    rotationY: 1,
  },
  {
    id: "10",
    name: "Hunter's Quiver",
    type: AssetType.TroopSecondary,
    troopType: TroopType.Crossbowman,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A leather quiver filled with hunting arrows.",
    drawChance: 16.9,
    modelPath: `${modelPath}/common_quiver.glb`,
    imagePath: "images/cosmetics/common-quiver.png",
    positionY: 0,
    scale: 0.8,
    rotationX: 0,
    rotationZ: -0.8,
  },
  {
    id: "11",
    name: "Carved Wooden Base",
    type: AssetType.TroopBase,
    troopType: undefined,
    rarity: AssetRarity.Common,
    set: AssetSet.S1AlternatesSet,
    description: "A basic-but-sturdy wooden platform.",
    drawChance: 16.9,
    modelPath: `${modelPath}/common_platform.glb`,
    imagePath: "images/cosmetics/common-base.png",
    positionY: 0.2,
    scale: 1,
    cameraPosition: { x: -0.4, y: 3, z: 1 },
  },
];

const getTypeClass = (type: AssetType) => {
  switch (type) {
    case AssetType.TroopArmor:
      return "bg-blue-600 text-white";
    case AssetType.TroopPrimary:
      return "bg-blue-500 text-white";
    case AssetType.TroopSecondary:
      return "bg-purple-600 text-white";
    case AssetType.TroopAura:
      return "bg-yellow-600 text-black";
    case AssetType.TroopBase:
      return "bg-orange-500 text-white";
    case AssetType.RealmSkin:
      return "bg-purple-500 text-white";
    case AssetType.RealmAura:
      return "bg-green-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const getRarityClass = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.text || "text-gray-500";
};

const getRarityBgClass = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.bg || "bg-gray-500";
};

const getRarityGlowClass = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.glow || "border-2 border-gray-500 bg-gray-500/15";
};

const getRarityAccentColor = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.hex || "#6b7280";
};

const getItemSet = (item: ChestAsset): string => {
  return item.set;
};

const calculateRarityStats = (items: ChestAsset[]) => {
  const stats = {
    legendary: 0,
    epic: 0,
    rare: 0,
    uncommon: 0,
    common: 0,
  };

  items.forEach((item) => {
    stats[item.rarity]++;
  });

  return stats;
};

// Function to sort assets by rarity (rarest first)
const sortAssetsByRarity = (assets: ChestAsset[]): ChestAsset[] => {
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  return [...assets].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
};

// Add custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  
  .item-preview-image {
    animation: fadeIn 0.3s ease-out;
  }
`;

export const ChestContent = ({
  chestType,
  showContent,
  chestContent,
}: {
  chestType: AssetRarity;
  showContent: boolean;
  chestContent: ChestAsset[];
}) => {
  // Sort assets by rarity (rarest first)
  const sortedChestContent = sortAssetsByRarity(chestContent);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const selectedAsset = sortedChestContent[selectedIndex];
  const rarityStats = calculateRarityStats(chestContent);
  const RARITY_PERCENTAGES = calculateRarityPercentages(chestAssets);

  const { playClickSound } = useClickSound({
    src: "/sound/ui/click-2.wav",
    volume: 0.6,
  });

  const handleAssetSelect = (index: number) => {
    if (index === selectedIndex) return;

    // Play click sound
    playClickSound();

    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(index);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const renderTitle = () => {
    return (
      <h1
        className="flex items-center justify-center gap-2 text-4xl font-bold text-center text-white"
        style={{
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        <span className={getRarityClass(chestType)}>{chestType.toUpperCase()} Chest</span>
        <span className="text-sm text-white">(3 items)</span>
      </h1>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <div className="relative w-full h-screen text-white">
        {/* Full-screen 3D background */}
        <div
          className="absolute inset-0"
          style={{
            transition: "opacity 300ms",
            opacity: showContent && !isTransitioning ? 1 : 0,
          }}
        >
          <ModelViewer
            rarity={selectedAsset.rarity}
            modelPath={selectedAsset.modelPath}
            className="w-full h-full"
            positionY={selectedAsset.positionY}
            scale={selectedAsset.scale}
            rotationY={selectedAsset.rotationY}
            rotationZ={selectedAsset.rotationZ}
            rotationX={selectedAsset.rotationX}
            cameraPosition={selectedAsset.cameraPosition}
          />
        </div>

        {/* Overlay UI - pointer-events-none to allow 3D interaction */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          {/* Title at top */}
          <div className="flex justify-center pt-8">{renderTitle()}</div>

          {/* Main content area with drop rates on left and items on right */}
          <div className="flex-1 flex justify-between items-center px-8">
            {/* Left sidebar with Drop Rate Summary and Item Preview */}
            <div
              className="pointer-events-auto space-y-4"
              style={{
                transition: "opacity 1000ms",
                opacity: showContent ? 1 : 0,
              }}
            >
              {/* Drop Rate Summary */}
              <div className="p-4 bg-gradient-to-br from-black/80 to-gray-900/60 rounded-xl border-2 border-gray-600 shadow-2xl backdrop-blur-sm">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-yellow-400" />
                  Drop Rates
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-rarity-legendary font-medium text-sm flex items-center gap-1">
                      <Diamond className="w-3 h-3" />
                      Legendary
                    </span>
                    <span className="text-white text-xs font-heading">{RARITY_PERCENTAGES.legendary}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-rarity-epic font-medium text-sm flex items-center gap-1">
                      <Diamond className="w-3 h-3" />
                      Epic
                    </span>
                    <span className="text-white text-xs font-heading">{RARITY_PERCENTAGES.epic}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-rarity-rare font-medium text-sm flex items-center gap-1">
                      <Diamond className="w-3 h-3" />
                      Rare
                    </span>
                    <span className="text-white text-xs font-heading">{RARITY_PERCENTAGES.rare}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-rarity-uncommon font-medium text-sm flex items-center gap-1">
                      <Diamond className="w-3 h-3" />
                      Uncommon
                    </span>
                    <span className="text-white text-xs font-heading">{RARITY_PERCENTAGES.uncommon}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-rarity-common font-medium text-sm flex items-center gap-1">
                      <Diamond className="w-3 h-3" />
                      Common
                    </span>
                    <span className="text-white text-xs font-heading">{RARITY_PERCENTAGES.common}%</span>
                  </div>
                </div>
              </div>

              {/* Selected Item Preview */}
              <div
                className="p-5 bg-gradient-to-br from-black/80 to-gray-900/60 rounded-xl border-2 shadow-2xl backdrop-blur-sm transition-all duration-300"
                style={{
                  borderColor: getRarityAccentColor(selectedAsset.rarity),
                  boxShadow: `0 0 30px ${getRarityAccentColor(selectedAsset.rarity)}40`,
                }}
              >
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-yellow-400" />
                  Selected Item
                </h4>

                {/* Item Image */}
                <div className="relative mb-4 overflow-hidden rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-900/50">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: `radial-gradient(circle at center, ${getRarityAccentColor(selectedAsset.rarity)}40 0%, transparent 70%)`,
                    }}
                  />
                  <img
                    key={selectedAsset.id}
                    src={selectedAsset.imagePath}
                    alt={selectedAsset.name}
                    className="w-full h-48 object-contain relative z-10 item-preview-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/images/placeholder.png";
                    }}
                  />
                </div>

                {/* Item Details */}
                <div className="space-y-2 w-[250px]">
                  <h3 className="text-base font-bold text-white break-words">{selectedAsset.name}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${getRarityBgClass(selectedAsset.rarity)} `}
                    >
                      {selectedAsset.rarity.toUpperCase()}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getTypeClass(selectedAsset.type)}`}>
                      {selectedAsset.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed mt-2">Drop chance: {selectedAsset.drawChance}%</p>
                </div>
              </div>
            </div>

            {/* Asset list on the right side */}
            <div
              className="w-[420px] max-h-[90vh] overflow-y-auto space-y-4 pointer-events-auto custom-scrollbar"
              style={{
                transition: "opacity 1000ms",
                opacity: showContent ? 1 : 0,
              }}
            >
              {/* Container for the asset list */}
              <div className="backdrop-blur-md rounded-2xl p-6 bg-gradient-to-br from-black/80 to-gray-900/60 border-2 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]">
                {/* Container header */}
                <div className="mb-4 text-center">
                  <div className="text-sm text-white font-heading font-semibold tracking-wider uppercase flex items-center justify-center gap-2">
                    <Swords className="w-4 h-4" />
                    Item Selection
                    <Swords className="w-4 h-4" />
                  </div>
                  <div className="mt-1 w-16 mx-auto h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
                  {/* Rarity breakdown */}
                  <div className="mt-3 flex justify-center gap-3 text-xs">
                    {rarityStats.legendary > 0 && (
                      <span className="text-rarity-legendary flex items-center gap-1">
                        <Diamond className="w-2 h-2" />
                        {rarityStats.legendary} Legendary
                      </span>
                    )}
                    {rarityStats.epic > 0 && (
                      <span className="text-rarity-epic flex items-center gap-1">
                        <Diamond className="w-2 h-2" />
                        {rarityStats.epic} Epic
                      </span>
                    )}
                    {rarityStats.rare > 0 && (
                      <span className="text-rarity-rare flex items-center gap-1">
                        <Diamond className="w-2 h-2" />
                        {rarityStats.rare} Rare
                      </span>
                    )}
                    {rarityStats.uncommon > 0 && (
                      <span className="text-rarity-uncommon flex items-center gap-1">
                        <Diamond className="w-2 h-2" />
                        {rarityStats.uncommon} Uncommon
                      </span>
                    )}
                    {rarityStats.common > 0 && (
                      <span className="text-rarity-common flex items-center gap-1">
                        <Diamond className="w-2 h-2" />
                        {rarityStats.common} Common
                      </span>
                    )}
                  </div>
                </div>

                {/* Asset grid with enhanced spacing */}
                <div className="space-y-3">
                  {sortedChestContent.map((asset, index) => {
                    const isSelected = index === selectedIndex;
                    const baseCardClass = "cursor-pointer transition-all duration-200 backdrop-blur-sm";
                    const cardClass = isSelected
                      ? `${baseCardClass} ${getRarityGlowClass(asset.rarity)}`
                      : `${baseCardClass} border-2 border-gray-600 bg-black/40 hover:border-gray-500 hover:bg-white/10`;

                    const itemSet = getItemSet(asset);

                    return (
                      <Card
                        key={index}
                        className={cardClass}
                        onClick={() => handleAssetSelect(index)}
                        style={{
                          transition: "all 0.3s ease",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            {/* Left side - Asset image/icon */}
                            <div className="flex-shrink-0">
                              <div
                                className={`w-12 h-12 text-white rounded-lg flex items-center justify-center ${getRarityBgClass(asset.rarity)} border `}
                              >
                                {(asset.type === AssetType.TroopArmor ||
                                  asset.type === AssetType.TroopPrimary ||
                                  asset.type === AssetType.TroopSecondary) && <Swords className="w-6 h-6" />}
                                {asset.type === AssetType.RealmSkin && <Target className="w-6 h-6" />}
                                {(asset.type === AssetType.TroopAura || asset.type === AssetType.RealmAura) && (
                                  <Diamond className="w-6 h-6" />
                                )}
                                {asset.type === AssetType.TroopBase && <BarChart3 className="w-6 h-6" />}
                              </div>
                            </div>

                            {/* Right side - Asset details */}
                            <div className="flex-1 min-w-0">
                              {/* Header row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-white text-sm leading-tight mb-1 truncate">
                                    {asset.name}
                                  </h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full font-medium text-white ${getRarityBgClass(asset.rarity)}`}
                                    >
                                      {asset.rarity.toUpperCase()}
                                    </span>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeClass(asset.type)}`}
                                    >
                                      {asset.type.toUpperCase()}
                                    </span>
                                    {/* Drop rate badge */}
                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                                      {asset.drawChance}% Drop
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Additional info row */}
                              <div className="flex items-center gap-2 mb-3">
                                {asset.troopType && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-slate-700/80 text-slate-200 border border-slate-600/50">
                                    {TroopType[asset.troopType]}
                                  </span>
                                )}
                                {itemSet && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-600/30 text-indigo-200 border border-indigo-500/40">
                                    {itemSet}
                                  </span>
                                )}
                              </div>

                              {/* Expandable description */}
                              {isSelected && (
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                  <p className="text-xs text-white leading-relaxed">{asset.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
