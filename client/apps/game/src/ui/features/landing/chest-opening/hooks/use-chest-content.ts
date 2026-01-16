import { getCosmeticsAddress } from "@/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchCollectibleClaimed } from "../services";
import { ChestAsset, COSMETIC_NAMES, getAllChestAssets, getChestAssetFromAttributesRaw } from "../utils/cosmetics";

// Helper to normalize metadata for consistent parsing
const normalizeMetadata = (metadata: string | null | undefined): any => {
  if (!metadata) return null;
  try {
    return typeof metadata === "string" ? JSON.parse(metadata) : metadata;
  } catch {
    return null;
  }
};

// Parse CollectibleClaimed data to extract chest assets with timestamp grouping
const parseCollectibleClaimedData = (eventData: { metadata?: string | null; timestamp?: string }[]): ChestAsset[] => {
  if (!eventData || eventData.length === 0) return [];

  // Group items by timestamp to identify items from the same chest opening
  const timestampGroups = new Map<string, any[]>();
  
  eventData.forEach((event) => {
    if (event.timestamp && event.metadata) {
      const timestamp = event.timestamp;
      if (!timestampGroups.has(timestamp)) {
        timestampGroups.set(timestamp, []);
      }
      timestampGroups.get(timestamp)!.push(event);
    }
  });

  // Get the most recent timestamp group (latest chest opening)
  const sortedTimestamps = Array.from(timestampGroups.keys()).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  if (sortedTimestamps.length === 0) return [];

  const latestItems = timestampGroups.get(sortedTimestamps[0]) || [];
  const parsedAssets: ChestAsset[] = [];

  latestItems.forEach((item) => {
    const metadata = normalizeMetadata(item.metadata);
    if (metadata?.attributes) {
      // Find matching cosmetic by attributes
      const matchingCosmetic = COSMETIC_NAMES.find((cosmetic) => {
        const cosmeticMetadata = normalizeMetadata(cosmetic.attributesRaw);
        if (!cosmeticMetadata) return false;
        
        // Compare attributes arrays
        return JSON.stringify(cosmeticMetadata) === JSON.stringify(metadata.attributes);
      });

      if (matchingCosmetic) {
        const asset = getChestAssetFromAttributesRaw(matchingCosmetic.attributesRaw);
        if (asset) {
          parsedAssets.push(asset);
        }
      }
    }
  });

  return parsedAssets;
};

interface UseChestContentReturn {
  chestContent: ChestAsset[];
  resetChestContent: () => void;
}

/**
 * Hook to listen for CollectibleClaimed events and parse chest contents.
 * Polls the events API to detect when new cosmetics are claimed.
 */
export function useChestContent(debugMode: boolean = false, timestamp: number): UseChestContentReturn {
  const [chestContent, setChestContent] = useState<ChestAsset[]>([]);
  const previousLengthRef = useRef<number>(0);

  const { address: rawAddress } = useAccount();
  // Remove leading zeros from the address
  const address = rawAddress ? `0x${rawAddress.slice(2).replace(/^0+/, "")}` : undefined;
  const cosmeticsAddress = getCosmeticsAddress();

  const { data: collectibleClaimedQuery } = useQuery({
    queryKey: ["collectibleClaimed", address, timestamp],
    queryFn: () => (address && cosmeticsAddress ? fetchCollectibleClaimed(cosmeticsAddress, address, timestamp) : null),
    refetchInterval: 3_000,
    enabled: !!address && !!cosmeticsAddress && timestamp > 0,
  });

  useEffect(() => {
    // Debug mode: return all chest assets
    if (debugMode) {
      setChestContent(getAllChestAssets());
      return;
    }

    if (collectibleClaimedQuery && Array.isArray(collectibleClaimedQuery)) {
      const currentLength = collectibleClaimedQuery.length;
      const previousLength = previousLengthRef.current;

      // If new items were added, parse all items to get latest chest opening
      if (currentLength > previousLength) {
        // Parse all the token transfer data to extract chest assets from latest chest
        const newAssets: ChestAsset[] = parseCollectibleClaimedData(collectibleClaimedQuery);

        if (newAssets.length > 0) {
          setChestContent(newAssets);
        }
      }

      // Update ref with current length for next comparison
      previousLengthRef.current = currentLength;
    }
  }, [collectibleClaimedQuery, debugMode, timestamp]);

  const resetChestContent = () => {
    setChestContent([]);
  };

  return { chestContent, resetChestContent };
}
