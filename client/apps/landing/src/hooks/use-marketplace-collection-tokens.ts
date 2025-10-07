import { useCollection, useListedTokensForCollection, useMarketplace } from "@cartridge/marketplace";
import { useMemo } from "react";

import { trimAddress } from "@/lib/utils";
import type { MergedNftData, RealmMetadata } from "@/types";
import { useMarketplaceContext } from "./context/marketplace-context";

const LEGACY_TRAIT_KEY_COLLECTIONS = new Set<string>([
  "0x36017e69d21d6d8c13e266eabb73ef1f1d02722d86bdcabe5f168f8e549d3cd",
]);

export interface FetchAllCollectionTokensOptions {
  ownerAddress?: string;
  limit?: number;
  offset?: number;
  traitFilters?: Record<string, string[]>;
  sortBy?: "price_asc" | "price_desc" | "token_id_asc" | "token_id_desc" | "listed_first";
  listedOnly?: boolean;
}

interface UseMarketplaceCollectionTokensResult {
  tokens: MergedNftData[];
  totalCount: number;
  isLoading: boolean;
}

const normalizeTokenId = (input: string | number | bigint | undefined | null) => {
  if (input === undefined || input === null) return undefined;
  const value = input.toString();
  if (value.startsWith("0x")) {
    try {
      return BigInt(value).toString();
    } catch (_error) {
      return value;
    }
  }
  return value;
};

const normalizeAddress = (address?: string | null) => {
  if (!address) return undefined;
  return trimAddress(address).toLowerCase();
};

const attributeMatches = (
  metadata: RealmMetadata | null,
  traitType: string,
  values: string[],
  useLegacyTraitKey: boolean,
) => {
  if (!metadata?.attributes?.length) return false;
  const traitKey = useLegacyTraitKey ? "trait" : "trait_type";
  return values.some((value) =>
    metadata.attributes.some((attribute: any) => {
      const currentTraitType = attribute?.[traitKey] ?? attribute?.trait_type;
      const currentValue = attribute?.value?.toString();
      return currentTraitType === traitType && currentValue === value;
    }),
  );
};

export const useMarketplaceCollectionTokens = (
  collectionAddress: string,
  options: FetchAllCollectionTokensOptions = {},
): UseMarketplaceCollectionTokensResult => {
  const { ownerAddress, limit, offset, traitFilters = {}, sortBy = "listed_first", listedOnly } = options;

  const { isReady } = useMarketplaceContext();

  const normalizedCollectionAddress = useMemo(() => normalizeAddress(collectionAddress), [collectionAddress]);
  const useLegacyTraitKey = useMemo(
    () => (normalizedCollectionAddress ? LEGACY_TRAIT_KEY_COLLECTIONS.has(normalizedCollectionAddress) : false),
    [normalizedCollectionAddress],
  );

  console.log("collectionAddress", collectionAddress);

  const test = useMarketplace();

  console.log({ test });

  const { data: listedOrders, isLoading: listingsLoading } = useListedTokensForCollection(collectionAddress);

  console.log({ listedOrders });

  const tokenIds = useMemo(() => {
    const ids = (listedOrders ?? [])
      .map((order) => normalizeTokenId(order.tokenId))
      .filter((value): value is string => Boolean(value));
    return ids;
  }, [listedOrders]);

  const { collection: tokenMetadata, isLoading: metadataLoading } = useCollection(
    collectionAddress,
    tokenIds,
    Math.max(tokenIds.length, 1),
  );

  const tokenMetadataMap = useMemo(() => {
    const map = new Map<string, any>();
    tokenMetadata.forEach((token) => {
      const normalizedId = normalizeTokenId((token as any)?.token_id ?? (token as any)?.tokenId);
      if (normalizedId) {
        map.set(normalizedId, token);
      }
    });
    return map;
  }, [tokenMetadata]);

  const normalizedOwner = useMemo(() => normalizeAddress(ownerAddress), [ownerAddress]);

  const mergedTokens = useMemo(() => {
    if (!listedOrders) return [] as MergedNftData[];

    const baseTokens: MergedNftData[] = listedOrders.map((order) => {
      const normalizedId = normalizeTokenId(order.tokenId) ?? "0";
      const metadataToken = tokenMetadataMap.get(normalizedId);
      const rawMetadata = metadataToken?.metadata ?? null;
      const metadata: RealmMetadata | null = rawMetadata ?? null;

      const priceBigInt = order.price !== undefined && order.price !== null ? BigInt(order.price) : null;

      const token: MergedNftData = {
        metadata,
        minPrice: priceBigInt,
        marketplaceOwner: order.owner,
        order_id: order.id ?? null,
        expiration: order.expiration ?? null,
        account_address: metadataToken?.token_owner ?? null,
        order_owner: order.owner ?? null,
        best_price_hex: priceBigInt,
        token_id: normalizedId,
        contract_address: collectionAddress,
        name: metadata?.name ?? null,
        collection_floor_price: null,
        token_owner: metadataToken?.token_owner ?? null,
      };
      return token;
    });

    const filteredByOwner = normalizedOwner
      ? baseTokens.filter((token) => normalizeAddress(token.order_owner) === normalizedOwner)
      : baseTokens;

    const filteredByListing = listedOnly
      ? filteredByOwner.filter((token) => token.best_price_hex !== null)
      : filteredByOwner;

    const filteredByTraits = Object.entries(traitFilters).reduce((acc, [traitType, values]) => {
      if (!values || values.length === 0) return acc;
      return acc.filter((token) => attributeMatches(token.metadata, traitType, values, useLegacyTraitKey));
    }, filteredByListing);

    const sorted = [...filteredByTraits];
    sorted.sort((a, b) => {
      const priceA = a.best_price_hex ?? BigInt(0);
      const priceB = b.best_price_hex ?? BigInt(0);
      const idA = (() => {
        try {
          return BigInt(a.token_id.toString());
        } catch (_error) {
          return BigInt(0);
        }
      })();
      const idB = (() => {
        try {
          return BigInt(b.token_id.toString());
        } catch (_error) {
          return BigInt(0);
        }
      })();

      const compareIds = () => {
        if (idA === idB) return 0;
        return idA < idB ? -1 : 1;
      };

      switch (sortBy) {
        case "price_asc":
          if (a.best_price_hex === null && b.best_price_hex !== null) return 1;
          if (a.best_price_hex !== null && b.best_price_hex === null) return -1;
          if (priceA === priceB) return compareIds();
          return priceA < priceB ? -1 : 1;
        case "price_desc":
          if (a.best_price_hex === null && b.best_price_hex !== null) return 1;
          if (a.best_price_hex !== null && b.best_price_hex === null) return -1;
          if (priceA === priceB) return compareIds() * -1;
          return priceA > priceB ? -1 : 1;
        case "token_id_desc":
          if (idA === idB) return 0;
          return idA > idB ? -1 : 1;
        case "token_id_asc":
          if (idA === idB) return 0;
          return idA < idB ? -1 : 1;
        case "listed_first":
        default:
          if (a.best_price_hex !== null && b.best_price_hex === null) return -1;
          if (a.best_price_hex === null && b.best_price_hex !== null) return 1;
          if (priceA === priceB) return compareIds();
          return priceA < priceB ? -1 : 1;
      }
    });

    return sorted;
  }, [
    listedOrders,
    tokenMetadataMap,
    collectionAddress,
    normalizedOwner,
    listedOnly,
    traitFilters,
    useLegacyTraitKey,
    sortBy,
  ]);

  const totalCount = mergedTokens.length;
  const paginatedTokens = useMemo(() => {
    if (limit === undefined || offset === undefined) {
      return mergedTokens;
    }
    return mergedTokens.slice(offset, offset + limit);
  }, [mergedTokens, limit, offset]);

  return {
    tokens: paginatedTokens,
    totalCount,
    isLoading: !isReady || listingsLoading || metadataLoading,
  };
};
