import { getCosmeticsAddress } from "@/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchMintedCosmetics } from "../services";
import {
  ChestAsset,
  COSMETIC_NAMES,
  getAllChestAssets,
  getChestAssetFromAttributesRaw,
  getTraitValuesFromAttributesRaw,
} from "../utils/cosmetics";
import { RealmMetadata } from "../utils/types";

// Parse metadata to find matching ChestAsset
const parseMetadataToChestAsset = (metadata: RealmMetadata | null): ChestAsset | undefined => {
  if (!metadata?.attributes) return undefined;

  // Find matching cosmetic by comparing attributes
  const matchingCosmetic = COSMETIC_NAMES.find((cosmetic) => {
    const traits = getTraitValuesFromAttributesRaw(cosmetic.attributesRaw);
    // Compare traits with metadata attributes (check that all cosmetic traits exist in metadata)
    return traits.every((trait) =>
      metadata.attributes?.some(
        (attr) => attr.trait_type === trait.trait_type && String(attr.value) === String(trait.value),
      ),
    );
  });

  if (matchingCosmetic) {
    return getChestAssetFromAttributesRaw(matchingCosmetic.attributesRaw);
  }
  return undefined;
};

interface UseChestContentReturn {
  chestContent: ChestAsset[];
  resetChestContent: () => void;
}

/**
 * Hook to detect minted cosmetics and parse chest contents.
 * Polls the token_transfers table to detect when new cosmetics are minted.
 * Groups items by timestamp and shows only the latest batch (from the same chest opening).
 */
export function useChestContent(debugMode: boolean = false, timestamp: number): UseChestContentReturn {
  const [chestContent, setChestContent] = useState<ChestAsset[]>([]);
  // Track the baseline count from first poll (pre-existing items to ignore)
  const baselineLengthRef = useRef<number | null>(null);
  // Track the timestamp to reset baseline when opening a new chest
  const lastTimestampRef = useRef<number>(0);

  // Reset baseline when timestamp changes (new chest opening)
  if (timestamp !== lastTimestampRef.current) {
    baselineLengthRef.current = null;
    lastTimestampRef.current = timestamp;
  }

  const { address: rawAddress } = useAccount();
  // Remove leading zeros from the address
  const address = rawAddress ? `0x${rawAddress.slice(2).replace(/^0+/, "")}` : undefined;
  const cosmeticsAddress = getCosmeticsAddress();

  const { data: mintedCosmeticsQuery } = useQuery({
    queryKey: ["mintedCosmetics", address, timestamp],
    queryFn: () => (address && cosmeticsAddress ? fetchMintedCosmetics(cosmeticsAddress, address, timestamp) : null),
    refetchInterval: 3_000,
    enabled: !!address && !!cosmeticsAddress && timestamp > 0,
  });

  console.log({ mintedCosmeticsQuery });

  useEffect(() => {
    // Debug mode: return all chest assets
    if (debugMode) {
      setChestContent(getAllChestAssets());
      return;
    }

    if (mintedCosmeticsQuery && Array.isArray(mintedCosmeticsQuery)) {
      const currentLength = mintedCosmeticsQuery.length;

      // First poll: establish baseline of pre-existing items (don't process them)
      if (baselineLengthRef.current === null) {
        baselineLengthRef.current = currentLength;
        console.log("Baseline established:", currentLength, "pre-existing items");
        return;
      }

      const baselineLength = baselineLengthRef.current;

      // Only process items that appeared AFTER we established the baseline
      if (currentLength > baselineLength) {
        const newItemCount = currentLength - baselineLength;
        // New items are at the BEGINNING of the array (ordered DESC by executed_at)
        const newTokens = mintedCosmeticsQuery.slice(0, newItemCount);

        console.log("New items detected:", newItemCount, newTokens);

        // Group by executed_at timestamp and take only the latest batch
        const groupedByTimestamp = new Map<string, typeof newTokens>();
        for (const token of newTokens) {
          const key = token.executed_at;
          if (!groupedByTimestamp.has(key)) {
            groupedByTimestamp.set(key, []);
          }
          groupedByTimestamp.get(key)!.push(token);
        }

        // Get the latest timestamp batch (first one since ordered DESC)
        const latestTimestamp = newTokens[0]?.executed_at;
        const latestBatch = latestTimestamp ? (groupedByTimestamp.get(latestTimestamp) ?? []) : [];

        // Parse metadata to extract chest assets
        const newAssets: ChestAsset[] = latestBatch
          .map((token) => parseMetadataToChestAsset(token.metadata as RealmMetadata | null))
          .filter((asset): asset is ChestAsset => asset !== undefined);

        if (newAssets.length > 0) {
          setChestContent(newAssets);
        }
      }
    }
  }, [mintedCosmeticsQuery, debugMode]);

  const resetChestContent = () => {
    setChestContent([]);
  };

  return { chestContent, resetChestContent };
}
