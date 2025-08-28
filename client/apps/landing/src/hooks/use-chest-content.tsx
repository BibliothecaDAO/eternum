import { ChestAsset, chestAssets } from "@/components/modules/chest-content";
import { getCosmeticsAddress } from "@/components/ui/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchCollectibleClaimed } from "./services";

// Parse CollectibleClaimed event data to extract chest assets
const parseCollectibleClaimedData = (eventData: any[]): ChestAsset[] => {
  const parsedAssets: ChestAsset[] = [];

  eventData.forEach((event) => {
    if (event.keys) {
      // Split keys by "/" to get individual values
      const keyValues = event.keys.split("/");

      // The 3rd value (index 2) is the attributes_raw
      if (keyValues.length >= 3) {
        const attributesRaw = keyValues[2];

        // Find matching asset in chestAssets
        const matchingAsset = chestAssets.find((asset) => asset.attributesRaw === attributesRaw);

        if (matchingAsset) {
          parsedAssets.push(matchingAsset);
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
  const address = rawAddress ? `0x${rawAddress.slice(3)}` : undefined;
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
      setChestContent(chestAssets);
      return;
    }

    if (collectibleClaimedQuery && Array.isArray(collectibleClaimedQuery)) {
      const currentLength = collectibleClaimedQuery.length;

      // If exactly 3 new items were added, get the last 3 items
      if (currentLength === previousLengthRef.current + 3) {
        const lastThreeTokens = collectibleClaimedQuery.slice(-3);

        // Parse the event data to extract chest assets
        const newAssets: ChestAsset[] = parseCollectibleClaimedData(lastThreeTokens);

        setChestContent(newAssets);
      }

      // Update ref with current length for next comparison
      previousLengthRef.current = currentLength;
    }
  }, [collectibleClaimedQuery, debugMode, timestamp]); // Added debugMode and timestamp to dependencies

  const resetChestContent = () => {
    setChestContent([]);
  };

  return { chestContent, resetChestContent };
};
