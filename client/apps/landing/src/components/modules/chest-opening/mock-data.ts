import { env } from "../../../../env";
import { AssetRarity, ChestAsset, chestAssets } from "@/utils/cosmetics";
import { MergedNftData } from "@/types";

// Check if mock mode is enabled via environment variable
export const MOCK_CHEST_OPENING = env.VITE_PUBLIC_CHEST_DEBUG_MODE === true;

// Mock chest data for testing the UI without blockchain interaction
export const MOCK_CHESTS: Partial<MergedNftData>[] = [
  {
    token_id: "1",
    metadata: {
      name: "Loot Chest",
      description: "A common loot chest",
      image: "/images/chest-common.png",
      attributes: [{ trait_type: "Rarity", value: "Common" }],
    },
  },
  {
    token_id: "2",
    metadata: {
      name: "Loot Chest",
      description: "A rare loot chest",
      image: "/images/chest-rare.png",
      attributes: [{ trait_type: "Rarity", value: "Rare" }],
    },
  },
  {
    token_id: "3",
    metadata: {
      name: "Loot Chest",
      description: "An epic loot chest",
      image: "/images/chest-epic.png",
      attributes: [{ trait_type: "Rarity", value: "Epic" }],
    },
  },
  {
    token_id: "4",
    metadata: {
      name: "Loot Chest",
      description: "A legendary loot chest",
      image: "/images/chest-legendary.png",
      attributes: [{ trait_type: "Rarity", value: "Legendary" }],
    },
  },
];

// Get a random subset of chest assets for mock reveals
export const getMockRevealAssets = (count: number = 3): ChestAsset[] => {
  const shuffled = [...chestAssets].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Get mock assets weighted by a specific rarity (for testing specific rarity videos)
export const getMockRevealAssetsByRarity = (targetRarity: AssetRarity, count: number = 3): ChestAsset[] => {
  // Include at least one asset of the target rarity
  const targetAssets = chestAssets.filter((a) => a.rarity === targetRarity);
  const otherAssets = chestAssets.filter((a) => a.rarity !== targetRarity);

  const result: ChestAsset[] = [];

  // Add one target rarity asset
  if (targetAssets.length > 0) {
    result.push(targetAssets[Math.floor(Math.random() * targetAssets.length)]);
  }

  // Fill the rest with random assets
  const shuffledOthers = otherAssets.sort(() => Math.random() - 0.5);
  while (result.length < count && shuffledOthers.length > 0) {
    result.push(shuffledOthers.pop()!);
  }

  return result;
};

// Simulate blockchain delay for mock mode
export const simulatePendingDelay = (): Promise<void> => {
  const delay = 1500 + Math.random() * 1000; // 1.5-2.5 seconds
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Determine chest rarity from metadata (for video selection)
export const getChestRarityFromMetadata = (metadata?: MergedNftData["metadata"]): AssetRarity => {
  if (!metadata?.attributes) return AssetRarity.Common;

  const rarityAttr = metadata.attributes.find((attr) => attr.trait_type.toLowerCase() === "rarity");

  if (rarityAttr) {
    const value = String(rarityAttr.value).toLowerCase();
    if (value === "legendary") return AssetRarity.Legendary;
    if (value === "epic") return AssetRarity.Epic;
    if (value === "rare") return AssetRarity.Rare;
    if (value === "uncommon") return AssetRarity.Uncommon;
  }

  return AssetRarity.Common;
};
