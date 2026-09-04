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

type MarketplaceCollection =
  (typeof marketplaceCollections)[keyof typeof marketplaceCollections];

function hasAddress(
  collection: MarketplaceCollection,
): collection is MarketplaceCollection & { address: string } {
  return "address" in collection && typeof collection.address === "string";
}

export function getCollectionByAddress(
  address: string,
): MarketplaceCollection | null {
  const normalizedAddress = address.trim().toLowerCase();

  for (const key in marketplaceCollections) {
    const item =
      marketplaceCollections[key as keyof typeof marketplaceCollections];
    if (!hasAddress(item)) continue;
    if (item.address.trim().toLowerCase() === normalizedAddress) {
      return item;
    }
  }

  return null;
}
