import { Card, CardContent } from "@/components/ui/card";
import { TroopType } from "@bibliothecadao/types";
import { useState } from "react";
import { ModelViewer } from "./model-viewer";

export interface ChestAsset {
  id: string;
  name: string;
  type: "armor" | "skin" | "aura" | "title";
  troopType: TroopType | undefined;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  description: string;
  drawChance: number;
  modelPath: string;
  positionY: number;
  scale: number;
  rotationY?: number | undefined;
}

export const chestAssets: ChestAsset[] = [
  {
    id: "2",
    name: "Legacy Guardian",
    type: "armor",
    troopType: TroopType.Knight,
    rarity: "legendary",
    description:
      "An impressive and timeless Knight armor set, inspired by the Knight troop models of Eternum Season 1. Part of the First Legacy Set.",
    drawChance: 1.41,
    modelPath: "models/cosmetics/high-res/legacy_knight_t3.glb",
    positionY: 0.2,
    scale: 1,
  },
  {
    id: "3",
    name: "Aura of the Legacy Warrior",
    type: "aura",
    troopType: undefined,
    rarity: "legendary",
    description: "An aura of golden magnificence for troops of a distinguished Realm. Part of the First Legacy Set.",
    drawChance: 1.41,
    modelPath: "models/cosmetics/high-res/s1_legacy_troop_aura.glb",
    positionY: 0,
    scale: 1,
  },
  {
    id: "4",
    name: "Aura of the Legacy Realm",
    type: "aura",
    troopType: undefined,
    rarity: "epic",
    description: "An aura of golden magnificence for a distinguished Realm. Part of the First Legacy Set.",
    drawChance: 4.22,
    modelPath: "models/cosmetics/high-res/s1_legacy_realm_aura.glb",
    positionY: -0.1,
    scale: 2.4,
  },
  {
    id: "5",
    name: "Winterhold",
    type: "skin",
    troopType: undefined,
    rarity: "rare",
    description: "The icy domain of a Lord that has withstood the fiercest of winters. Part of the Winter Lord Set.",
    drawChance: 8.45,
    modelPath: "models/cosmetics/high-res/castle_winter_lord_l3.glb",
    positionY: 0,
    scale: 1,
    rotationY: -2,
  },
  {
    id: "6",
    name: "Winter's Palisade",
    type: "aura",
    troopType: undefined,
    rarity: "rare",
    description: "A ring of razor-sharp ice spikes to deter a Lord's foes. Part of the Winter Lord Set.",
    drawChance: 8.45,
    modelPath: "models/cosmetics/high-res/winter_lord_spike_aura.glb",
    positionY: 0.2,
    scale: 1,
  },
  {
    id: "7",
    name: "Battleaxe of the Winter Paladin",
    type: "armor",
    troopType: TroopType.Paladin,
    rarity: "uncommon",
    description: "A frosty, spiked battleaxe wielded by Winter Paladins. Part of the Winter Lord Set.",
    drawChance: 12.68,
    modelPath: "models/cosmetics/high-res/winter_lord_paladin_primary.glb",
    positionY: 0.5,
    scale: 1,
    rotationY: -1.5,
  },
  {
    id: "8",
    name: "Shield of the Winter Paladin",
    type: "armor",
    troopType: TroopType.Paladin,
    rarity: "uncommon",
    description:
      "An elegant, snowflake-patterned cavalry shield wielded by Winter Paladins. Part of the Winter Lord Set.",
    drawChance: 12.68,
    modelPath: "models/cosmetics/high-res/winter_lord_paladin_secondary.glb",
    positionY: 0.5,
    scale: 1,
    rotationY: -1.5,
  },
  {
    id: "9",
    name: "Hunter's Bow",
    type: "armor",
    troopType: TroopType.Crossbowman,
    rarity: "common",
    description: "A wooden hunting bow. Part of the S1 Alternates Set",
    drawChance: 16.9,
    modelPath: "models/cosmetics/high-res/bow_common.glb",
    positionY: -0.8,
    scale: 1,
    rotationY: 5,
  },
  {
    id: "10",
    name: "Hunter's Quiver",
    type: "armor",
    troopType: TroopType.Crossbowman,
    rarity: "common",
    description: "A leather quiver filled with hunting arrows. Part of the S1 Alternates Set",
    drawChance: 16.9,
    modelPath: "models/cosmetics/high-res/common_quiver.glb",
    positionY: 0,
    scale: 1,
  },
  {
    id: "11",
    name: "Carved Wooden Base",
    type: "aura",
    troopType: undefined,
    rarity: "common",
    description: "A basic-but-sturdy wooden platform. Part of the S1 Alternates Set",
    drawChance: 16.9,
    modelPath: "models/cosmetics/high-res/common_platform.glb",
    positionY: 0.2,
    scale: 1,
  },
];

const getTypeClass = (type: ChestAsset["type"]) => {
  switch (type) {
    case "armor":
      return "bg-blue-600 text-white";
    case "skin":
      return "bg-purple-600 text-white";
    case "aura":
      return "bg-yellow-600 text-black";
    case "title":
      return "bg-green-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const getRarityClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "text-white";
    case "uncommon":
      return "text-white";
    case "rare":
      return "text-white";
    case "epic":
      return "text-white";
    case "legendary":
      return "text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

const getRarityBgClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "bg-[#848484]";
    case "uncommon":
      return "bg-[#6cc95e]";
    case "rare":
      return "bg-[#56c8da]";
    case "epic":
      return "bg-[#e9b062]";
    case "legendary":
      return "bg-[#ba37d4]";
    default:
      return "bg-gray-500";
  }
};

const getRarityGlowClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "border-2 border-[#848484] bg-[#848484]/15 shadow-[0_0_15px_rgba(132,132,132,0.4)]";
    case "uncommon":
      return "border-2 border-[#6cc95e] bg-[#6cc95e]/20 shadow-[0_0_18px_rgba(108,201,94,0.5)]";
    case "rare":
      return "border-2 border-[#56c8da] bg-[#56c8da]/20 shadow-[0_0_22px_rgba(86,200,218,0.6)]";
    case "epic":
      return "border-2 border-[#e9b062] bg-[#e9b062]/20 shadow-[0_0_28px_rgba(233,176,98,0.6)]";
    case "legendary":
      return "border-2 border-[#ba37d4] bg-[#ba37d4]/20 shadow-[0_0_35px_rgba(186,55,212,0.7)]";
    default:
      return "border-2 border-gray-500 bg-gray-500/15";
  }
};

const getRarityTextClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "text-[#848484]";
    case "uncommon":
      return "text-[#6cc95e]";
    case "rare":
      return "text-[#56c8da]";
    case "epic":
      return "text-[#e9b062]";
    case "legendary":
      return "text-[#ba37d4]";
    default:
      return "text-gray-500";
  }
};

const getItemSet = (item: ChestAsset): string => {
  if (item.description.includes("First Legacy Set")) return "First Legacy Set";
  if (item.description.includes("Winter Lord Set")) return "Winter Lord Set";
  if (item.description.includes("S1 Alternates Set")) return "S1 Alternates Set";
  return "";
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

// Function to shuffle array and pick 3 random items
export const getRandomAssets = (assets: ChestAsset[], count: number = 3): ChestAsset[] => {
  const shuffled = [...assets].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
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
`;

export const ChestContent = ({ showContent, chestContent }: { showContent: boolean; chestContent: ChestAsset[] }) => {
  // Sort assets by rarity (rarest first)
  const sortedChestContent = sortAssetsByRarity(chestContent);
  const [selectedAsset, setSelectedAsset] = useState<ChestAsset>(sortedChestContent[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const rarityStats = calculateRarityStats(chestContent);

  const handleAssetSelect = (asset: ChestAsset) => {
    if (asset.id === selectedAsset.id) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedAsset(asset);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const renderTitle = () => {
    return (
      <h1
        className="flex items-center justify-center gap-2 text-4xl font-bold text-chest-gold text-center"
        style={{
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        Loot Chest Content
        <span className="text-sm text-white">(3 items)</span>
      </h1>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <div className="relative w-full h-screen">
        {/* Full-screen 3D background */}
        <div
          className="absolute inset-0"
          style={{
            transition: "opacity 5000ms",
            opacity: showContent && !isTransitioning ? 1 : 0,
          }}
        >
          <ModelViewer
            modelPath={selectedAsset.modelPath}
            className="w-full h-full"
            positionY={selectedAsset.positionY}
            scale={selectedAsset.scale}
            rotationY={selectedAsset.rotationY}
          />
        </div>

        {/* Overlay UI - pointer-events-none to allow 3D interaction */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          {/* Title at top */}
          <div className="flex justify-center pt-8">{renderTitle()}</div>

          {/* Main content area with drop rates on left and items on right */}
          <div className="flex-1 flex justify-between items-center px-8">
            {/* Drop Rate Summary on the left */}
            <div
              className="pointer-events-auto"
              style={{
                transition: "opacity 1000ms",
                opacity: showContent ? 1 : 0,
              }}
            >
              <div className="p-5 bg-gradient-to-br from-black/80 to-gray-900/60 rounded-xl border-2 border-gray-600 shadow-2xl backdrop-blur-sm">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="text-yellow-400">📊</span> Drop Rate Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[#ba37d4] font-medium flex items-center gap-2">
                      <span className="text-lg">◆</span> Legendary
                    </span>
                    <span className="text-gray-300 text-sm font-heading ml-8">2.82%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[#e9b062] font-medium flex items-center gap-2">
                      <span className="text-lg">◆</span> Epic
                    </span>
                    <span className="text-gray-300 text-sm font-heading ml-8">4.22%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[#56c8da] font-medium flex items-center gap-2">
                      <span className="text-lg">◆</span> Rare
                    </span>
                    <span className="text-gray-300 text-sm font-heading ml-8">16.90%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[#6cc95e] font-medium flex items-center gap-2">
                      <span className="text-lg">◆</span> Uncommon
                    </span>
                    <span className="text-gray-300 text-sm font-heading ml-8">25.36%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[#848484] font-medium flex items-center gap-2">
                      <span className="text-lg">◆</span> Common
                    </span>
                    <span className="text-gray-300 text-sm font-heading ml-8">50.70%</span>
                  </div>
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
                  <div className="text-sm text-gray-300 font-heading font-semibold tracking-wider uppercase">
                    ⚔️ Item Selection ⚔️
                  </div>
                  <div className="mt-1 w-16 mx-auto h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
                  {/* Rarity breakdown */}
                  <div className="mt-3 flex justify-center gap-3 text-xs">
                    {rarityStats.legendary > 0 && (
                      <span className="text-[#ba37d4]">⬥ {rarityStats.legendary} Legendary</span>
                    )}
                    {rarityStats.epic > 0 && <span className="text-[#e9b062]">⬥ {rarityStats.epic} Epic</span>}
                    {rarityStats.rare > 0 && <span className="text-[#56c8da]">⬥ {rarityStats.rare} Rare</span>}
                    {rarityStats.uncommon > 0 && (
                      <span className="text-[#6cc95e]">⬥ {rarityStats.uncommon} Uncommon</span>
                    )}
                    {rarityStats.common > 0 && <span className="text-[#848484]">⬥ {rarityStats.common} Common</span>}
                  </div>
                </div>

                {/* Asset grid with enhanced spacing */}
                <div className="space-y-3">
                  {sortedChestContent.map((asset) => {
                    const isSelected = selectedAsset.id === asset.id;
                    const baseCardClass = "cursor-pointer transition-all duration-200 backdrop-blur-sm";
                    const cardClass = isSelected
                      ? `${baseCardClass} ${getRarityGlowClass(asset.rarity)}`
                      : `${baseCardClass} border-2 border-gray-600 bg-black/40 hover:border-gray-500 hover:bg-white/10`;

                    const itemSet = getItemSet(asset);

                    return (
                      <Card
                        key={asset.id}
                        className={cardClass}
                        onClick={() => handleAssetSelect(asset)}
                        style={{
                          transition: "all 0.3s ease",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-white">{asset.name}</h3>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${getRarityBgClass(asset.rarity)} ${getRarityClass(asset.rarity)}`}
                                >
                                  {asset.rarity.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs ${getTypeClass(asset.type)}`}>
                                  {asset.type.toUpperCase()}
                                </span>
                                {asset.troopType && (
                                  <span className="text-xs px-2 py-1 rounded bg-gray-600 text-white">
                                    {TroopType[asset.troopType]}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">{asset.drawChance}% chance</span>
                              </div>
                              {isSelected && (
                                <p className="text-xs text-gray-300 mt-2 leading-relaxed">{asset.description}</p>
                              )}
                              {itemSet && (
                                <div className="mt-2">
                                  <span className="text-xs px-2 py-1 rounded bg-indigo-600/50 text-indigo-200 border border-indigo-500/30">
                                    {itemSet}
                                  </span>
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
