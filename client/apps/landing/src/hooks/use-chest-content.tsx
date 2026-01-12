import { getCosmeticsAddress } from "@/components/ui/utils/addresses";
import { ChestAsset, getChestAssetFromAttributesRaw, getAllChestAssets, COSMETIC_NAMES } from "@/utils/cosmetics";
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

// Parse CollectibleClaimed event data to extract chest assets
const parseCollectibleClaimedData = (eventData: any[]): ChestAsset[] => {
  const parsedAssets: ChestAsset[] = [];

  eventData.forEach((event) => {
    if (event.keys) {
      // Split keys by "/" to get individual values
      const keyValues = event.keys.split("/");

      // The 3rd value (index 2) is the attributes_raw
      if (keyValues.length >= 3) {
        const eventAttributesRaw = normalizeAttributesRaw(keyValues[2]);

        // Find matching cosmetic by normalized attributesRaw
        const matchingCosmetic = COSMETIC_NAMES.find(
          (cosmetic) => normalizeAttributesRaw(cosmetic.attributesRaw) === eventAttributesRaw,
        );

        if (matchingCosmetic) {
          const asset = getChestAssetFromAttributesRaw(matchingCosmetic.attributesRaw);
          if (asset) {
            parsedAssets.push(asset);
          }
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

  console.log("collectibleClaimedQuery", collectibleClaimedQuery, timestamp);

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
