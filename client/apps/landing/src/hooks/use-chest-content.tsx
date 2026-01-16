import { getCosmeticsAddress } from "@/components/ui/utils/addresses";
import { ChestAsset, COSMETIC_NAMES, getAllChestAssets, getChestAssetFromAttributesRaw } from "@/utils/cosmetics";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchCollectibleClaimed } from "./services";

// Helper to normalize attributesRaw for comparison (remove leading zeros after 0x)
const normalizeAttributesRaw = (raw: string): string => {
  if (!raw.startsWith("0x")) return raw;
  // Remove 0x, strip leading zeros, add 0x back
  const hex = raw.slice(2).replace(/^0+/, "");
  return "0x" + (hex || "0");
};

// Extract attributes_raw from token metadata
const extractAttributesRawFromMetadata = (metadata: string | null): string | null => {
  if (!metadata) return null;
  
  try {
    const metadataObj = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (metadataObj && metadataObj.attributes && Array.isArray(metadataObj.attributes)) {
      // Look for an attribute with trait_type "attributes_raw" or similar
      const attributesRawTrait = metadataObj.attributes.find(
        (attr: any) => attr.trait_type === "attributes_raw" || attr.trait_type === "Attributes Raw"
      );
      if (attributesRawTrait) {
        return attributesRawTrait.value;
      }
    }
  } catch (error) {
    console.warn("Failed to parse token metadata:", error);
  }
  
  return null;
};

// Parse CollectibleClaimed token transfer data to extract chest assets
// Groups items by timestamp to identify items from the same chest opening
// Returns items from the most recent chest opening
const parseCollectibleClaimedData = (tokenData: any[]): ChestAsset[] => {
  if (!tokenData.length) return [];

  // Group tokens by executed_at timestamp (chest opening events)
  const tokensByTimestamp = new Map<string, any[]>();
  
  tokenData.forEach((token) => {
    const timestamp = token.executed_at;
    if (!tokensByTimestamp.has(timestamp)) {
      tokensByTimestamp.set(timestamp, []);
    }
    tokensByTimestamp.get(timestamp)!.push(token);
  });

  // Get the most recent timestamp (latest chest opening)
  const timestamps = Array.from(tokensByTimestamp.keys()).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  if (timestamps.length === 0) return [];

  // Get tokens from the most recent chest opening
  const latestTokens = tokensByTimestamp.get(timestamps[0]) || [];
  const parsedAssets: ChestAsset[] = [];

  latestTokens.forEach((token) => {
    // Extract attributes_raw from metadata
    const attributesRaw = extractAttributesRawFromMetadata(token.metadata);
    
    if (attributesRaw) {
      const normalizedAttributesRaw = normalizeAttributesRaw(attributesRaw);

      // Find matching cosmetic by normalized attributesRaw
      const matchingCosmetic = COSMETIC_NAMES.find(
        (cosmetic) => normalizeAttributesRaw(cosmetic.attributesRaw) === normalizedAttributesRaw,
      );

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

// todo: this is not good, we need to listen to CollectibleClaimed events but they
// were not indexed yet. This is a temporary solution to get the chest content.
export const useChestContent = (debugMode: boolean = false, timestamp: number) => {
  const [chestContent, setChestContent] = useState<ChestAsset[]>([]);
  const previousLengthRef = useRef<number>(0);

  const { address: rawAddress } = useAccount();
  // Remove leading zeros from the address
  const address = rawAddress ? `0x${rawAddress.slice(2).replace(/^0+/, "")}` : undefined;
  const cosmeticsAddress = getCosmeticsAddress();

  const { data: collectibleClaimedQuery } = useQuery({
    queryKey: ["collectibleClaimed", address, timestamp],
    queryFn: () => (address ? fetchCollectibleClaimed(cosmeticsAddress, address, timestamp) : null),
    refetchInterval: 3_000,
  });

  useEffect(() => {
    // Debug mode: return all chest assets
    if (debugMode) {
      console.log("Debug mode enabled - returning all chest assets");
      setChestContent(getAllChestAssets());
      return;
    }

    if (collectibleClaimedQuery && Array.isArray(collectibleClaimedQuery)) {
      const currentLength = collectibleClaimedQuery.length;
      const previousLength = previousLengthRef.current;

      // If new items were added, get all the new items
      if (currentLength > previousLength) {
        const newItemCount = currentLength - previousLength;
        const newTokens = collectibleClaimedQuery.slice(-newItemCount);

        // Parse the event data to extract chest assets
        const newAssets: ChestAsset[] = parseCollectibleClaimedData(newTokens);

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
};
