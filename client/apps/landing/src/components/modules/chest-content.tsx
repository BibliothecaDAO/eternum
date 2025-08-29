import { useClickSound } from "@/hooks/use-click-sound";
import {
  AssetRarity,
  AssetType,
  calculateRarityPercentages,
  ChestAsset,
  chestAssets,
  RARITY_STYLES,
} from "@/utils/cosmetics";
import { TroopType } from "@bibliothecadao/types";
import { Castle, Crown, Diamond, Hexagon, Shield, Sparkles, Sword } from "lucide-react";
import { useState } from "react";
import { ModelViewer } from "./model-viewer";

// chestAssets, COSMETIC_NAMES, RARITY_STYLES, and calculateRarityPercentages are imported from @/utils/cosmetics

const getRarityClass = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.text || "text-gray-500";
};

const getRarityBgClass = (rarity: AssetRarity) => {
  return RARITY_STYLES[rarity]?.bg || "bg-gray-500";
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
const sortAssetsByRarity = (assets: (ChestAsset & { count: number })[]): (ChestAsset & { count: number })[] => {
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  return [...assets].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
};

// Group assets by type and sort each group by rarity
const groupAssetsByType = (
  assets: (ChestAsset & { count: number })[],
): Map<AssetType, (ChestAsset & { count: number })[]> => {
  const grouped = new Map<AssetType, (ChestAsset & { count: number })[]>();

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

// Group identical assets by their id and count them
const groupIdenticalAssets = (assets: ChestAsset[]): (ChestAsset & { count: number })[] => {
  const grouped = new Map<string, ChestAsset & { count: number }>();

  assets.forEach((asset) => {
    const existing = grouped.get(asset.id);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(asset.id, { ...asset, count: 1 });
    }
  });

  return Array.from(grouped.values());
};

export const ChestContent = ({
  chestType,
  showContent,
  chestContent,
}: {
  chestType: AssetRarity;
  showContent: boolean;
  chestContent: ChestAsset[];
}) => {
  // Group identical assets by their id and count them
  const uniqueAssets = groupIdenticalAssets(chestContent);

  // Group assets by type and sort each group by rarity
  const groupedAssets = groupAssetsByType(uniqueAssets);

  // Create a flat array for selection
  const flatAssets: (ChestAsset & { count: number })[] = [];
  groupedAssets.forEach((group) => {
    flatAssets.push(...group);
  });

  // Find the most rare item (Legendary first, then Epic, etc.)
  const findMostRareItemIndex = (assets: (ChestAsset & { count: number })[]): number => {
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    let mostRareIndex = 0;
    let highestRarity = rarityOrder.common;

    assets.forEach((asset, index) => {
      const assetRarity = rarityOrder[asset.rarity];
      if (assetRarity < highestRarity) {
        highestRarity = assetRarity;
        mostRareIndex = index;
      }
    });

    return mostRareIndex;
  };

  const [selectedIndex, setSelectedIndex] = useState<number>(() => findMostRareItemIndex(flatAssets));
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

    // Change selection immediately - animation is handled in ModelViewer
    setSelectedIndex(index);
  };

  const renderTitle = () => {
    const rarityColor = getRarityAccentColor(chestType);
    return (
      <div
        className="flex justify-center"
        style={{
          transition: "opacity 1000ms",
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
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarityColor }}></div>
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
        <div
          className="absolute inset-0"
          style={{
            opacity: showContent ? 1 : 0,
            transition: "opacity 1000ms",
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
                      <span className="text-sm font-medium text-rarity-legendary">Legendary</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{RARITY_PERCENTAGES.legendary}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-epic"></div>
                      <span className="text-sm font-medium text-rarity-epic">Epic</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{RARITY_PERCENTAGES.epic}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-rare"></div>
                      <span className="text-sm font-medium text-rarity-rare">Rare</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{RARITY_PERCENTAGES.rare}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-uncommon"></div>
                      <span className="text-sm font-medium text-rarity-uncommon">Uncommon</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{RARITY_PERCENTAGES.uncommon}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rarity-common"></div>
                      <span className="text-sm font-medium text-rarity-common">Common</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{RARITY_PERCENTAGES.common}%</span>
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
              className="w-[420px] max-h-[75vh] overflow-y-auto space-y-4 pointer-events-auto custom-scrollbar"
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
                          // Find the index of this asset in flatAssets
                          const assetIndex = flatAssets.findIndex((fa) => fa.id === asset.id);
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
                                  <div className="flex-shrink-0 relative">
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
                                            const iconWrapper = document.createElement("div");
                                            iconWrapper.className = "w-full h-full flex items-center justify-center";
                                            parent.appendChild(iconWrapper);
                                          }
                                        }}
                                      />
                                    </div>
                                    {asset.count > 1 && (
                                      <div className="absolute -top-1 -right-1 bg-slate-800 text-gray-300 text-xs px-1.5 py-0.5 rounded-md font-bold border border-slate-600/50">
                                        {asset.count}
                                      </div>
                                    )}
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
