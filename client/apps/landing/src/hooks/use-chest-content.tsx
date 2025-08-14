import { ChestAsset, chestAssets } from "@/components/modules/chest-content";
import { getCosmeticsAddress } from "@/components/ui/utils/addresses";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchTokenBalancesWithMetadata } from "./services";

// todo: this is not good, we need to listen to CollectibleClaimed events but they
// were not indexed yet. This is a temporary solution to get the chest content.
export const useChestContent = () => {
  const [chestContent, setChestContent] = useState<ChestAsset[]>([]);
  const previousLengthRef = useRef<number>(0);

  const { address } = useAccount();
  const cosmeticsAddress = getCosmeticsAddress();

  const { data: tokenBalanceQuery } = useQuery({
    queryKey: ["tokenBalance", address],
    queryFn: () => (address ? fetchTokenBalancesWithMetadata(cosmeticsAddress, address) : null),
    refetchInterval: 3_000,
  });

  useEffect(() => {
    if (tokenBalanceQuery && Array.isArray(tokenBalanceQuery)) {
      const currentLength = tokenBalanceQuery.length;

      console.log({ currentLength, previousLengthRef: previousLengthRef.current });
      // If array length increased, get the last 3 items
      if (previousLengthRef.current > 0 && currentLength > previousLengthRef.current) {
        const lastThreeTokens = tokenBalanceQuery.slice(-3);

        // Convert to ChestAsset format
        const newAssets: ChestAsset[] = lastThreeTokens
          .map((token) => {
            const epochItem = token.metadata?.attributes?.find((attr) => attr.trait_type === "Epoch Item")?.value;
            const knownAsset = chestAssets.find((asset: ChestAsset) => asset.id === epochItem);
            return knownAsset || null;
          })
          .filter((asset): asset is ChestAsset => asset !== null);

        setChestContent(newAssets);
      }

      // Update ref with current length for next comparison
      previousLengthRef.current = currentLength;
    }
  }, [tokenBalanceQuery]); // Only depend on tokenBalanceQuery

  const resetChestContent = () => {
    setChestContent([]);
  };

  return { chestContent, resetChestContent };
};
