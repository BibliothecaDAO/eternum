import { ChainId } from "./chains";

export const marketplaceCollections = {
  realms: {
    id: {
      [ChainId.SN_MAIN]: 2,
      [ChainId.SN_SEPOLIA]: 4,
    },
    name: "Realms",
    image: "/collections/realms.png",
  },
  /*"season-passes": {
      address: CollectionAddresses,
      id: COLLECTION_IDS[currentNetwork]["season-passes"],
      name: "Season 1 Pass",
      image: "/collections/season-1-pass.png",
    },*/
} as const;

export function getCollectionByAddress(
  address: string,
): (typeof marketplaceCollections)[keyof typeof marketplaceCollections] | null {
  const collection = Object.entries(marketplaceCollections).find(
    ([_, data]) => {
      return (
        trimAddress(data.address)?.toLowerCase() ===
        trimAddress(address)?.toLowerCase()
      );
    },
  );
  return collection ? collection[1] : null; // Default to season passes if not found
}
