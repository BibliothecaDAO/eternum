import { fetchTokenBalancesWithMetadata } from "@/hooks/services";
import { useClickSound } from "@/hooks/use-click-sound";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AssetRarity,
  AssetType,
  calculateRarityPercentages,
  ChestAsset,
  chestAssets,
  RARITY_STYLES,
} from "@/utils/cosmetics";
import { TroopType } from "@bibliothecadao/types";
import { useAccount } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Castle, Crown, Diamond, Dices, Hexagon, Info, Shield, Sparkles, Sword } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getCosmeticsAddress } from "../ui/utils/addresses";
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

// Calculate collection stats by rarity
const calculateCollectionStats = (allAssets: ChestAsset[], collectedIds: Set<string>) => {
  const stats = {
    legendary: { total: 0, collected: 0 },
    epic: { total: 1, collected: 0 },
    rare: { total: 0, collected: 0 },
    uncommon: { total: 0, collected: 0 },
    common: { total: 0, collected: 0 },
  };

  allAssets.forEach((asset) => {
    stats[asset.rarity].total++;
    if (collectedIds.has(asset.id)) {
      stats[asset.rarity].collected++;
    }
  });

  // Special case: if collected id "1" is present, add one epic item to collected count, because
  // it's not in the allAssets list since you can't get it from a chest
  if (collectedIds.has("1")) {
    stats.epic.collected++;
  }

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

// Add custom scrollbar styles with mobile optimization
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
  
  /* Mobile scrollbar styling */
  @media (max-width: 768px) {
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.3);
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
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

export const ChestContent = React.memo(
  ({
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
    const { address } = useAccount();
    const collectionAddress = getCosmeticsAddress();
    const [tokenBalanceQuery] = useSuspenseQueries({
      queries: [
        {
          queryKey: ["tokenBalance", collectionAddress, address],
          queryFn: () => {
            return address ? fetchTokenBalancesWithMetadata(collectionAddress, address) : null;
          },
          refetchInterval: 8_000,
        },
      ],
    });

    const [collectedItems, setCollectedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
      if (tokenBalanceQuery.data) {
        const itemIds = new Set<string>();

        tokenBalanceQuery.data.forEach((item) => {
          if (item.metadata?.attributes) {
            // Find the 'Epoch Item' attribute which contains the ID
            const epochItemAttr = item.metadata.attributes.find((attr: any) => attr.trait_type === "Epoch Item");

            if (epochItemAttr?.value) {
              itemIds.add(epochItemAttr.value.toString());
            }
          }
        });

        setCollectedItems(itemIds);
      }
    }, [tokenBalanceQuery.data]);

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

    const isMobile = useIsMobile();

    const [selectedIndex, setSelectedIndex] = useState<number>(() => findMostRareItemIndex(flatAssets));
    const [isItemsListExpanded, setIsItemsListExpanded] = useState(!isMobile);
    const [isCollectionExpanded, setIsCollectionExpanded] = useState(false);
    const selectedAsset = flatAssets[selectedIndex];
    const rarityStats = calculateRarityStats(chestContent);
    const RARITY_PERCENTAGES = calculateRarityPercentages(chestAssets);
    const collectionStats = calculateCollectionStats(chestAssets, collectedItems);
    console.log({ collectedItems });

    const { playClickSound } = useClickSound({
      src: "/sound/ui/click-2.wav",
      volume: 0.6,
      isMobile,
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
              className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-700/40 shadow-2xl mx-4 sm:mx-0"
              style={{
                borderColor: `${rarityColor}30`,
                boxShadow: `0 0 40px ${rarityColor}15`,
              }}
            >
              {/* Main title content */}
              <div className="flex flex-col items-center gap-1">
                <h1 className="text-2xl md:text-4xl font-heading font-bold text-gray-200 tracking-wide">
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
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-xs md:text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                    {chestContent.length} Items Revealed
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarityColor }}></div>
                    {chestType.charAt(0).toUpperCase() + chestType.slice(1)} Tier
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
            <div
              className="flex justify-center pt-4 md:pt-8"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            >
              {renderTitle()}
            </div>

            {/* Mobile Selected Item Preview - Hidden on mobile */}
            <div className="hidden"></div>

            {/* Main content area with drop rates on left and items on right */}
            <div className="flex-1 flex flex-col md:flex-row md:justify-between items-stretch px-4 lg:px-8 gap-4 overflow-hidden">
              {/* Left sidebar with Drop Rate Summary and Item Preview */}
              <div
                className="pointer-events-auto space-y-2 md:space-y-4 w-full md:w-[280px] flex flex-col max-h-[45vh] md:max-h-[calc(100vh-150px)] order-3 md:order-1"
                style={{
                  transition: "opacity 1000ms",
                  opacity: showContent ? 1 : 0,
                }}
              >
                {/* Collection Progress - Responsive */}
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-slate-800/20 rounded-xl border border-slate-700/50 backdrop-blur-sm shadow-xl flex-shrink-0 hidden sm:block overflow-hidden">
                  {/* Desktop/Tablet View */}
                  <div className="hidden md:block">
                    <div className="px-4 py-3 border-b border-slate-700/30 bg-slate-900/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-slate-800/50 rounded-lg">
                            <Crown className="w-4 h-4 text-gold" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-100">Collection Progress</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Your collected cosmetics</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border-2 border-gold/30 bg-gradient-to-br from-gold/10 to-gold/5">
                              <div className="text-xs font-bold text-gold">{collectedItems.size}/11</div>
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-gold/5" />
                            </div>
                          </div>
                        </div>
                        <button
                          className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-colors flex-shrink-0"
                          onClick={() => {
                            playClickSound();
                            setIsCollectionExpanded(!isCollectionExpanded);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${
                              isCollectionExpanded ? "rotate-180" : "rotate-0"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-400">Overall Progress</span>
                          <span className="text-xs font-bold text-gold">
                            {Math.round((collectedItems.size / 11) * 100)}%
                          </span>
                        </div>
                        <div className="relative w-full h-3 bg-slate-800/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-gold/70 via-gold to-gold/70 transition-all duration-700 ease-out relative rounded-full"
                            style={{ width: `${(collectedItems.size / 11) * 100}%` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
                          </div>
                        </div>
                      </div>

                      {/* Collection Stats by Rarity - Expandable */}
                      {isCollectionExpanded && (
                        <div className="transition-all duration-300 ease-out">
                          <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                            By Rarity
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(collectionStats).map(([rarity, stats]) => {
                              const rarityKey = rarity as AssetRarity;
                              const rarityColor = getRarityAccentColor(rarityKey);
                              const percentage = stats.total > 0 ? (stats.collected / stats.total) * 100 : 0;
                              const isCompleted = stats.collected === stats.total && stats.total > 0;

                              return (
                                <div key={rarity} className="group">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                                        style={{ backgroundColor: rarityColor }}
                                      />
                                      <span className={`text-xs font-semibold capitalize ${getRarityClass(rarityKey)}`}>
                                        {rarity}
                                      </span>
                                      {isCompleted && <Crown className="w-3 h-3 text-gold" />}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-bold text-gray-200">
                                        {stats.collected}/{stats.total}
                                      </span>
                                    </div>
                                  </div>
                                  {stats.total > 0 && (
                                    <div className="w-full h-1.5 bg-slate-800/40 rounded-full overflow-hidden">
                                      <div
                                        className="h-full transition-all duration-500 ease-out rounded-full"
                                        style={{
                                          width: `${percentage}%`,
                                          backgroundColor: `${rarityColor}${isCompleted ? "FF" : "80"}`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Small Screen Compact View */}
                  <div className="md:hidden">
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-slate-800/50 rounded">
                            <Crown className="w-3 h-3 text-gold" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-gray-100">Collection</h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-gold/30 bg-gradient-to-br from-gold/10 to-gold/5">
                              <div className="text-xs font-bold text-gold">{collectedItems.size}/11</div>
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-gold/5" />
                            </div>
                            <div className="text-xs font-semibold text-gold">
                              {Math.round((collectedItems.size / 11) * 100)}%
                            </div>
                          </div>
                        </div>
                        <button
                          className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-colors flex-shrink-0"
                          onClick={() => {
                            playClickSound();
                            setIsCollectionExpanded(!isCollectionExpanded);
                          }}
                        >
                          <svg
                            className={`w-3 h-3 text-gray-400 transform transition-transform duration-200 ${
                              isCollectionExpanded ? "rotate-180" : "rotate-0"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Compact progress bar */}
                      <div className="relative w-full h-2 bg-slate-800/50 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-gold/70 via-gold to-gold/70 transition-all duration-500 ease-out rounded-full"
                          style={{ width: `${(collectedItems.size / 11) * 100}%` }}
                        />
                      </div>

                      {/* Expandable rarity stats */}
                      {isCollectionExpanded && (
                        <div className="transition-all duration-300 ease-out mt-2">
                          <div className="grid grid-cols-1 gap-1.5">
                            {Object.entries(collectionStats).map(([rarity, stats]) => {
                              const rarityKey = rarity as AssetRarity;
                              const rarityColor = getRarityAccentColor(rarityKey);
                              const percentage = stats.total > 0 ? (stats.collected / stats.total) * 100 : 0;
                              const isCompleted = stats.collected === stats.total && stats.total > 0;

                              return (
                                <div key={rarity} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rarityColor }} />
                                    <span className={`text-xs capitalize ${getRarityClass(rarityKey)} font-medium`}>
                                      {rarity}
                                    </span>
                                    {isCompleted && <Crown className="w-2.5 h-2.5 text-gold" />}
                                  </div>
                                  <span className="text-xs font-bold text-gray-200">
                                    {stats.collected}/{stats.total}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selected Item Preview - Responsive */}
                <div
                  className={`p-2 sm:p-3 lg:p-5 bg-slate-900/20 rounded-xl border border-slate-700/30 backdrop-blur-sm shadow-xl border-l-4 flex-1 min-h-0 sm:flex flex-col hidden ${getRarityAccent(selectedAsset.rarity)}`}
                >
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex-shrink-0">Selected Item</h4>

                  {/* Item Image - Simplified */}
                  <div className="bg-slate-800/15 rounded-lg p-2 md:p-3 border border-slate-700/30 h-24 md:h-32 lg:h-40 flex items-center justify-center flex-shrink-0">
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
                  <div className="flex-1 space-y-3 overflow-hidden min-h-0 flex flex-col">
                    <div className="flex-shrink-0">
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

                    <div className="text-sm text-gray-400 space-y-1 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Dices className="w-3.5 h-3.5 text-gray-500" />
                        <p>
                          Drop Rate:{" "}
                          <span className="text-gray-200 font-bold">{selectedAsset.drawChance.toFixed(2)}%</span>
                        </p>
                      </div>
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

                    <div className="flex-1 min-h-0 overflow-hidden">
                      <p className="text-sm text-gray-400 leading-relaxed pt-2 border-t border-slate-700/50 h-full overflow-y-auto custom-scrollbar pr-2">
                        {selectedAsset.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacer to push items container to bottom on mobile */}
              <div className="flex-1 md:hidden" />

              {/* Right side container with items list and drop rates */}
              <div
                className="w-full md:w-[420px] flex flex-col gap-4 pointer-events-auto order-1 md:order-2 max-h-[40vh] md:max-h-[calc(100vh-150px)] mb-20 md:mb-0"
                style={{
                  transition: "opacity 1000ms",
                  opacity: showContent ? 1 : 0,
                }}
              >
                {/* Drop Rates Section - Enhanced Layout */}
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-slate-800/20 rounded-xl border border-slate-700/50 backdrop-blur-sm shadow-xl flex-shrink-0 hidden md:block overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/30 bg-slate-900/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-800/50 rounded-lg">
                          <Dices className="w-4 h-4 text-gold" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-100">Drop Rates</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Probability per rarity tier</p>
                        </div>
                      </div>
                      <div className="group relative">
                        <div className="p-1 hover:bg-slate-800/50 rounded-lg transition-colors cursor-help">
                          <Info className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <div className="absolute right-0 top-8 w-56 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20">
                          <p className="text-xs text-gray-300 leading-relaxed">
                            These percentages show the probability of receiving items of each rarity when opening this
                            chest type.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-5 gap-3">
                    {/* Legendary */}
                    <div className="group">
                      <div className="relative">
                        <div className="w-full h-24 bg-gradient-to-t from-slate-800/40 to-slate-800/20 rounded-lg relative overflow-hidden mb-2 border border-slate-700/30 group-hover:border-rarity-legendary/30 transition-colors">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-rarity-legendary/70 to-rarity-legendary/40 transition-all duration-500 ease-out"
                            style={{ height: `${Math.min(RARITY_PERCENTAGES.legendary * 2, 100)}%` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-bold text-rarity-legendary block mb-1">Legendary</span>
                          <span className="text-sm font-bold text-gray-100 flex items-center justify-center gap-1 bg-slate-900/60 backdrop-blur-sm rounded-md py-0.5">
                            {RARITY_PERCENTAGES.legendary.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Epic */}
                    <div className="group">
                      <div className="relative">
                        <div className="w-full h-24 bg-gradient-to-t from-slate-800/40 to-slate-800/20 rounded-lg relative overflow-hidden mb-2 border border-slate-700/30 group-hover:border-rarity-epic/30 transition-colors">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-rarity-epic/70 to-rarity-epic/40 transition-all duration-500 ease-out"
                            style={{ height: `${Math.min(RARITY_PERCENTAGES.epic * 2, 100)}%` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-bold text-rarity-epic block mb-1">Epic</span>
                          <span className="text-sm font-bold text-gray-100 flex items-center justify-center gap-1 bg-slate-900/60 backdrop-blur-sm rounded-md py-0.5">
                            {RARITY_PERCENTAGES.epic.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rare */}
                    <div className="group">
                      <div className="relative">
                        <div className="w-full h-24 bg-gradient-to-t from-slate-800/40 to-slate-800/20 rounded-lg relative overflow-hidden mb-2 border border-slate-700/30 group-hover:border-rarity-rare/30 transition-colors">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-rarity-rare/70 to-rarity-rare/40 transition-all duration-500 ease-out"
                            style={{ height: `${Math.min(RARITY_PERCENTAGES.rare * 2, 100)}%` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-bold text-rarity-rare block mb-1">Rare</span>
                          <span className="text-sm font-bold text-gray-100 flex items-center justify-center gap-1 bg-slate-900/60 backdrop-blur-sm rounded-md py-0.5">
                            {RARITY_PERCENTAGES.rare.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Uncommon */}
                    <div className="group">
                      <div className="relative">
                        <div className="w-full h-24 bg-gradient-to-t from-slate-800/40 to-slate-800/20 rounded-lg relative overflow-hidden mb-2 border border-slate-700/30 group-hover:border-rarity-uncommon/30 transition-colors">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-rarity-uncommon/70 to-rarity-uncommon/40 transition-all duration-500 ease-out"
                            style={{ height: `${Math.min(RARITY_PERCENTAGES.uncommon * 2, 100)}%` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-bold text-rarity-uncommon block mb-1">Uncommon</span>
                          <span className="text-sm font-bold text-gray-100 flex items-center justify-center gap-1 bg-slate-900/60 backdrop-blur-sm rounded-md py-0.5">
                            {RARITY_PERCENTAGES.uncommon.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Common */}
                    <div className="group">
                      <div className="relative">
                        <div className="w-full h-24 bg-gradient-to-t from-slate-800/40 to-slate-800/20 rounded-lg relative overflow-hidden mb-2 border border-slate-700/30 group-hover:border-rarity-common/30 transition-colors">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-rarity-common/70 to-rarity-common/40 transition-all duration-500 ease-out"
                            style={{ height: `${Math.min(RARITY_PERCENTAGES.common * 2, 100)}%` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-bold text-rarity-common block mb-1">Common</span>
                          <span className="text-sm font-bold text-gray-100 flex items-center justify-center gap-1 bg-slate-900/60 backdrop-blur-sm rounded-md py-0.5">
                            {RARITY_PERCENTAGES.common.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Asset list - Enhanced Layout */}
                <div
                  className={`${isItemsListExpanded ? "flex-1" : "max-h-[20vh]"} md:flex-1 overflow-hidden flex flex-col transition-all duration-300 ease-in-out min-h-0`}
                >
                  {/* Container for the asset list */}
                  <div className="rounded-xl bg-gradient-to-br from-slate-900/30 via-slate-900/20 to-slate-800/10 backdrop-blur-sm border border-slate-700/50 shadow-xl flex flex-col h-full overflow-hidden">
                    {/* Container header - Enhanced */}
                    <div className="px-4 py-3 border-b border-slate-700/30 bg-slate-900/20 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-800/50 rounded-lg">
                            <Diamond className="w-4 h-4 text-gold" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-100">Items Received</h3>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              {rarityStats.legendary > 0 && (
                                <span className="text-rarity-legendary font-semibold">
                                  {rarityStats.legendary} Legendary
                                </span>
                              )}
                              {rarityStats.epic > 0 && (
                                <span className="text-rarity-epic font-semibold">{rarityStats.epic} Epic</span>
                              )}
                              {rarityStats.rare > 0 && (
                                <span className="text-rarity-rare font-semibold">{rarityStats.rare} Rare</span>
                              )}
                              {rarityStats.uncommon > 0 && (
                                <span className="text-rarity-uncommon font-semibold">
                                  {rarityStats.uncommon} Uncommon
                                </span>
                              )}
                              {rarityStats.common > 0 && (
                                <span className="text-rarity-common font-semibold">{rarityStats.common} Common</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Mobile toggle button */}
                        <button
                          className="md:hidden p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                          onClick={() => {
                            playClickSound();
                            setIsItemsListExpanded(!isItemsListExpanded);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${
                              isItemsListExpanded ? "rotate-180" : "rotate-0"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {/* Mobile collapse hint */}
                      {!isItemsListExpanded && (
                        <div className="md:hidden px-4 pb-2 text-xs text-gray-500">
                          Tap to expand full list ({chestContent.length} items)
                        </div>
                      )}
                    </div>

                    {/* Asset grid grouped by type - Scrollable content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                      <div className={`space-y-4 ${!isItemsListExpanded ? "md:block hidden" : ""}`}>
                        {Array.from(groupedAssets.entries()).map(([type, assets]) => {
                          if (assets.length === 0) return null;

                          const TypeIcon = getAssetTypeIcon(type);

                          const displayedAssets = isMobile && !isItemsListExpanded ? assets.slice(0, 2) : assets;

                          return (
                            <div key={type} className="space-y-2">
                              {/* Category header */}
                              <div className="flex items-center gap-2 mb-2">
                                <TypeIcon className="w-4 h-4 text-gray-400" />
                                <h3 className="text-sm font-medium text-gray-400">{type}</h3>
                                <span className="text-sm text-gray-600">
                                  (
                                  {isMobile && !isItemsListExpanded && assets.length > 2
                                    ? `${displayedAssets.length}/${assets.length}`
                                    : assets.length}
                                  )
                                </span>
                              </div>

                              {/* Assets in this category */}
                              {displayedAssets.map((asset) => {
                                // Find the index of this asset in flatAssets
                                const assetIndex = flatAssets.findIndex((fa) => fa.id === asset.id);
                                const isSelected = assetIndex === selectedIndex;
                                const rarityColor = getRarityAccentColor(asset.rarity);
                                const baseCardClass =
                                  "cursor-pointer transition-all duration-200 border-l-4 rounded-lg";
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
                                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-md overflow-hidden bg-slate-700/20 border border-slate-600/30">
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
                                                  iconWrapper.className =
                                                    "w-full h-full flex items-center justify-center";
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
                                            <h3 className="text-sm md:text-base text-gray-200 font-semibold truncate pr-2">
                                              {asset.name}
                                            </h3>
                                            <div className="flex items-center gap-1 flex-shrink-0 group relative">
                                              <Dices className="w-3 h-3 text-gray-500" />
                                              <span className="text-xs md:text-sm text-gray-300 font-semibold">
                                                {asset.drawChance.toFixed(2)}%
                                              </span>
                                              <div className="absolute right-0 top-6 w-32 p-1.5 bg-slate-800 border border-slate-700 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-20">
                                                <p className="text-xs text-gray-300">Item drop rate</p>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Rarity badge and info */}
                                          <div className="flex items-center gap-3 mt-1">
                                            <span
                                              className={`text-xs px-1.5 md:px-2 py-0.5 rounded-full font-semibold ${getRarityBgClass(asset.rarity)}`}
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
                                                  <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">
                                                    {TroopType[asset.troopType]}
                                                  </span>
                                                )}
                                                {itemSet && (
                                                  <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">
                                                    {itemSet}
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>

                                          {/* Description - only when selected on desktop */}
                                          {isSelected && (
                                            <p className="text-xs md:text-sm text-gray-400 mt-2 leading-relaxed hidden md:block">
                                              {asset.description}
                                            </p>
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

                        {/* Mobile fade-out gradient when collapsed */}
                        {!isItemsListExpanded && (
                          <div className="md:hidden absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  },
);
