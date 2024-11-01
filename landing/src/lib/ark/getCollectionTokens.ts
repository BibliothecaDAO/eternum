import { /*createSearchParamsCache,*/ parseAsStringLiteral } from "nuqs/server";

import type { CollectionToken, Filters } from "@/types";

export const itemsPerPage = 50;

export const collectionSortDirectionKey = "direction";
export const collectionSortDirectionsValues = ["asc", "desc"] as const;
export const collectionSortDirectionsParser = parseAsStringLiteral(collectionSortDirectionsValues).withDefault("asc");
export type CollectionSortDirection = (typeof collectionSortDirectionsValues)[number];

export const collectionSortByKey = "sort";
export const collectionSortByValues = ["price"] as const;
export const collectionSortByParser = parseAsStringLiteral(collectionSortByValues).withDefault("price");
export type CollectionSortBy = (typeof collectionSortByValues)[number];

/*export const collectionPageSearchParamsCache = createSearchParamsCache({
  [collectionSortDirectionKey]: collectionSortDirectionsParser,
  [collectionSortByKey]: collectionSortByParser,
});*/

export interface CollectionTokensApiResponse {
  data: CollectionToken[];
  next_page: number | null;
  token_count: number;
}

interface GetCollectionTokensParams {
  collectionAddress: string;
  page?: number;
  sortDirection?: CollectionSortDirection;
  sortBy?: CollectionSortBy;
  filters?: Filters;
  buyNow?: boolean;
}

export async function getCollectionTokens({
  collectionAddress,
  page,
  sortDirection,
  sortBy,
  filters,
  buyNow,
}: GetCollectionTokensParams) {
  const queryParams = [`items_per_page=${itemsPerPage}`];

  if (Object.keys(filters?.traits ?? {}).length) {
    queryParams.push(`filters=${encodeURIComponent(JSON.stringify(filters))}`);
  }

  if (page !== undefined) {
    queryParams.push(`page=${page}`);
  }

  if (buyNow) {
    queryParams.push("buy_now=true");
  }

  if (sortBy !== undefined) {
    queryParams.push(`sort=${sortBy}`);
  }
  if (sortBy !== undefined) {
    queryParams.push(`direction=${sortDirection}`);
  }

  const url = `${
    import.meta.env.VITE_PUBLIC_ARK_MARKETPLACE_API
  }/collections/${collectionAddress}/0x534e5f4d41494e/tokens?${queryParams.join("&")}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(url, response.status);

    return {
      data: [],
      next_page: null,
      token_count: 0,
    };
  }

  const result = (await response.json()) as CollectionTokensApiResponse;

  return result;
}

export function getMediaSrc(
  src?: string | null,
  mediaKey?: string | null,
  thumbnailKey?: string | null,
  width?: number,
  height?: number,
) {
  if (thumbnailKey) {
    return `${import.meta.env.VITE_PUBLIC_IMAGE_CDN_URL}/${thumbnailKey}`;
  }

  if (mediaKey && width && height) {
    const resolutionParam = `:${width}:${height}`;
    return `${import.meta.env.VITE_PUBLIC_IMAGE_PROXY_URL}/_/rs:fit${resolutionParam}/plain/${
      import.meta.env.NEXT_PUBLIC_IMAGE_CDN_URL
    }/${mediaKey}`;
  }
  return src?.replace("ipfs://", import.meta.env.VITE_PUBLIC_IPFS_GATEWAY);
}
