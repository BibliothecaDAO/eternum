import { useClickSound } from "@/hooks/use-click-sound";
import { TroopType } from "@bibliothecadao/types";
import { Castle, Crown, Diamond, Hexagon, Shield, Sparkles, Sword } from "lucide-react";
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

// Minimalistic rarity accent for clean UI
const getRarityAccent = (rarity: AssetRarity) => {
  const colors = {
    legendary: "border-l-rarity-legendary/70 bg-rarity-legendary/5",
    epic: "border-l-rarity-epic/70 bg-rarity-epic/5",
    rare: "border-l-rarity-rare/70 bg-rarity-rare/5",
    uncommon: "border-l-rarity-uncommon/70 bg-rarity-uncommon/5",
    common: "border-l-rarity-common/70 bg-rarity-common/5",
  };
  return colors[rarity] || "border-l-gray-500/70 bg-gray-500/5";
};

const getRarityAccentColor = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.hex || "#6b7280";
};

const getItemSet = (item: ChestAsset): string => {
  return item.set;
};

// Get icon component for each asset type
const getAssetTypeIcon = (type: AssetType) => {
  switch (type) {
    case AssetType.TroopArmor:
      return Shield;
    case AssetType.TroopPrimary:
      return Sword;
    case AssetType.TroopSecondary:
      return Shield;
    case AssetType.TroopAura:
      return Sparkles;
    case AssetType.TroopBase:
      return Hexagon;
    case AssetType.RealmSkin:
      return Castle;
    case AssetType.RealmAura:
      return Crown;
    default:
      return Diamond;
  }
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

// Group assets by type and sort each group by rarity
const groupAssetsByType = (assets: ChestAsset[]): Map<AssetType, ChestAsset[]> => {
  const grouped = new Map<AssetType, ChestAsset[]>();

  // Define the order of asset types for consistent display
  const typeOrder = [
    AssetType.TroopArmor,
    AssetType.TroopPrimary,
    AssetType.TroopSecondary,
    AssetType.TroopAura,
    AssetType.TroopBase,
    AssetType.RealmSkin,
    AssetType.RealmAura,
  ];

  // Initialize map with empty arrays in order
  typeOrder.forEach((type) => grouped.set(type, []));

  // Group assets
  assets.forEach((asset) => {
    const group = grouped.get(asset.type) || [];
    group.push(asset);
    grouped.set(asset.type, group);
  });

  // Sort each group by rarity
  grouped.forEach((group, type) => {
    grouped.set(type, sortAssetsByRarity(group));
  });

  return grouped;
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
    animation: fadeIn 0.1s ease-out;
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
  // Group assets by type and sort each group by rarity
  const groupedAssets = groupAssetsByType(chestContent);

  // Create a flat array for index mapping
  const flatAssets: ChestAsset[] = [];
  groupedAssets.forEach((group) => {
    flatAssets.push(...group);
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [modelScale, setModelScale] = useState(1);
  const selectedAsset = flatAssets[selectedIndex];
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

    // Start scale down animation
    setModelScale(0);

    // Wait for scale down, then switch model and scale up
    setTimeout(() => {
      setSelectedIndex(index);
      // Immediately scale back up
      setModelScale(1);
    }, 80);
  };

  const renderTitle = () => {
    const rarityColor = getRarityAccentColor(chestType);
    return (
      <div
        className="flex justify-center"
        style={{
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        <div className="relative">
          {/* Decorative background container */}
          <div 
            className="px-8 py-4 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-700/40 shadow-2xl"
            style={{
              borderColor: `${rarityColor}30`,
              boxShadow: `0 0 40px ${rarityColor}15`,
            }}
          >
            {/* Main title content */}
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-4xl font-heading font-bold text-gray-200 tracking-wide">
                <span 
                  className={getRarityClass(chestType)}
                  style={{
                    textShadow: `0 0 20px ${rarityColor}40`,
                  }}
                >
                  {chestType.toUpperCase()}
                </span>
                <span className="text-gray-300 ml-2">Chest</span>
              </h1>
              
              {/* Subtitle with item count */}
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                  {chestContent.length} Items Revealed
                </span>
                <span className="flex items-center gap-1">
                  <div 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: rarityColor }}
                  ></div>
                  {chestType} Tier
                </span>
              </div>
            </div>
            
            {/* Decorative corner elements */}
            <div 
              className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 rounded-tl"
              style={{ borderColor: `${rarityColor}60` }}
            ></div>
            <div 
              className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 rounded-tr"
              style={{ borderColor: `${rarityColor}60` }}
            ></div>
            <div 
              className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 rounded-bl"
              style={{ borderColor: `${rarityColor}60` }}
            ></div>
            <div 
              className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 rounded-br"
              style={{ borderColor: `${rarityColor}60` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <div className="relative w-full h-screen text-white">
        {/* Full-screen 3D background */}
        <div className="absolute inset-0">
          {/* Model viewer with scale transition */}
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${modelScale})`,
              transition: "transform 80ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms",
              opacity: showContent ? 1 : 0,
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
        </div>

        {/* Overlay UI - pointer-events-none to allow 3D interaction */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          {/* Title at top */}
          <div className="flex justify-center pt-8">{renderTitle()}</div>

          {/* Main content area with drop rates on left and items on right */}
          <div className="flex-1 flex justify-between items-center px-8">
            {/* Left sidebar with Drop Rate Summary and Item Preview */}
            <div
              className="pointer-events-auto space-y-4 w-[280px]"
              style={{
                transition: "opacity 1000ms",
                opacity: showContent ? 1 : 0,
              }}
            >
              {/* Drop Rate Summary - Redesigned */}
              <div className="p-4 bg-slate-900/20 rounded-xl border border-slate-700/30 backdrop-blur-sm shadow-xl h-[220px] flex flex-col">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 text-center">Drop Rates</h4>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-legendary"></div>
                      <span className="text-xs font-medium text-rarity-legendary">Legendary</span>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{RARITY_PERCENTAGES.legendary}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-epic"></div>
                      <span className="text-xs font-medium text-rarity-epic">Epic</span>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{RARITY_PERCENTAGES.epic}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-rare"></div>
                      <span className="text-xs font-medium text-rarity-rare">Rare</span>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{RARITY_PERCENTAGES.rare}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-uncommon"></div>
                      <span className="text-xs font-medium text-rarity-uncommon">Uncommon</span>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{RARITY_PERCENTAGES.uncommon}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-common"></div>
                      <span className="text-xs font-medium text-rarity-common">Common</span>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{RARITY_PERCENTAGES.common}%</span>
                  </div>
                </div>
              </div>

              {/* Selected Item Preview - Minimalistic */}
              <div
                className={`p-5 bg-slate-900/20 rounded-xl border border-slate-700/30 backdrop-blur-sm shadow-xl border-l-4 h-[450px] flex flex-col ${getRarityAccent(selectedAsset.rarity)}`}
              >
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Selected Item</h4>

                {/* Item Image - Simplified */}
                <div className="bg-slate-800/15 rounded-lg p-4 border border-slate-700/30 h-40 flex items-center justify-center">
                  <img
                    key={selectedAsset.id}
                    src={selectedAsset.imagePath}
                    alt={selectedAsset.name}
                    className="max-w-full max-h-full object-contain item-preview-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/images/placeholder.png";
                    }}
                  />
                </div>

                {/* Item Details - Clean and minimal */}
                <div className="flex-1 space-y-3 overflow-hidden">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">{selectedAsset.name}</h3>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm px-3 py-1 rounded-full font-bold ${getRarityBgClass(selectedAsset.rarity)}`}
                        style={{
                          backgroundColor: `${getRarityAccentColor(selectedAsset.rarity)}30`,
                          color: getRarityAccentColor(selectedAsset.rarity),
                          border: `1px solid ${getRarityAccentColor(selectedAsset.rarity)}50`,
                        }}
                      >
                        {selectedAsset.rarity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-400">{selectedAsset.type}</span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-400 space-y-1">
                    <p>
                      Drop rate: <span className="text-gray-300 font-medium">{selectedAsset.drawChance}%</span>
                    </p>
                    {selectedAsset.troopType && (
                      <p>
                        Unit: <span className="text-gray-300 font-medium">{TroopType[selectedAsset.troopType]}</span>
                      </p>
                    )}
                    {getItemSet(selectedAsset) && (
                      <p>
                        Set: <span className="text-gray-300 font-medium">{getItemSet(selectedAsset)}</span>
                      </p>
                    )}
                  </div>

                  <p className="text-sm text-gray-400 leading-relaxed pt-2 border-t border-slate-700/50">
                    {selectedAsset.description}
                  </p>
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
              <div className="rounded-xl p-5 bg-slate-900/20 backdrop-blur-sm border border-slate-700/30 shadow-xl">
                {/* Container header - minimalistic */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-300">Items Received</h4>
                  {/* Simple rarity count */}
                  <div className="mt-1 flex items-center gap-4 text-sm">
                    {rarityStats.legendary > 0 && (
                      <span className="text-rarity-legendary">{rarityStats.legendary} Legendary</span>
                    )}
                    {rarityStats.epic > 0 && <span className="text-rarity-epic">{rarityStats.epic} Epic</span>}
                    {rarityStats.rare > 0 && <span className="text-rarity-rare">{rarityStats.rare} Rare</span>}
                    {rarityStats.uncommon > 0 && (
                      <span className="text-rarity-uncommon">{rarityStats.uncommon} Uncommon</span>
                    )}
                    {rarityStats.common > 0 && <span className="text-rarity-common">{rarityStats.common} Common</span>}
                  </div>
                </div>

                {/* Asset grid grouped by type */}
                <div className="space-y-4">
                  {Array.from(groupedAssets.entries()).map(([type, assets]) => {
                    if (assets.length === 0) return null;

                    const TypeIcon = getAssetTypeIcon(type);

                    return (
                      <div key={type} className="space-y-2">
                        {/* Category header */}
                        <div className="flex items-center gap-2 mb-2">
                          <TypeIcon className="w-4 h-4 text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-400">{type}</h3>
                          <span className="text-sm text-gray-600">({assets.length})</span>
                        </div>

                        {/* Assets in this category */}
                        {assets.map((asset) => {
                          const assetIndex = flatAssets.indexOf(asset);
                          const isSelected = assetIndex === selectedIndex;
                          const rarityColor = getRarityAccentColor(asset.rarity);
                          const baseCardClass = "cursor-pointer transition-all duration-200 border-l-4 rounded-lg";
                          const cardClass = isSelected
                            ? `${baseCardClass} ${getRarityAccent(asset.rarity)} bg-slate-800/25 border-slate-600/50`
                            : `${baseCardClass} border-l-transparent bg-slate-800/10 hover:bg-slate-800/20 border border-slate-700/30`;

                          const itemSet = getItemSet(asset);

                          return (
                            <div
                              key={asset.id}
                              className={cardClass}
                              onClick={() => handleAssetSelect(assetIndex)}
                              style={{
                                borderLeftColor: isSelected ? rarityColor : "transparent",
                                borderLeftWidth: "4px",
                              }}
                            >
                              <div className="p-3">
                                <div className="flex items-center gap-3">
                                  {/* NFT Image */}
                                  <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-700/20 border border-slate-600/30">
                                      <img
                                        src={asset.imagePath}
                                        alt={asset.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          const parent = target.parentElement;
                                          if (parent) {
                                            const Icon = getAssetTypeIcon(asset.type);
                                            const iconWrapper = document.createElement("div");
                                            iconWrapper.className = "w-full h-full flex items-center justify-center";
                                            parent.appendChild(iconWrapper);
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-base text-gray-200 font-semibold truncate pr-2">
                                        {asset.name}
                                      </h3>
                                      <span className="text-sm text-gray-400 flex-shrink-0 font-medium">
                                        {asset.drawChance}%
                                      </span>
                                    </div>

                                    {/* Rarity badge and info */}
                                    <div className="flex items-center gap-3 mt-1">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getRarityBgClass(asset.rarity)}`}
                                        style={{
                                          backgroundColor: `${rarityColor}30`,
                                          color: rarityColor,
                                          border: `1px solid ${rarityColor}50`,
                                        }}
                                      >
                                        {asset.rarity.toUpperCase()}
                                      </span>

                                      {/* Show additional info only when selected */}
                                      {isSelected && (
                                        <>
                                          {asset.troopType && (
                                            <span className="text-sm text-gray-500">{TroopType[asset.troopType]}</span>
                                          )}
                                          {itemSet && <span className="text-sm text-gray-500">{itemSet}</span>}
                                        </>
                                      )}
                                    </div>

                                    {/* Description - only when selected */}
                                    {isSelected && (
                                      <p className="text-sm text-gray-400 mt-2 leading-relaxed">{asset.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
