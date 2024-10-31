import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import type {
    CollectionSortBy,
    CollectionSortDirection,
    CollectionTokensApiResponse,
} from "@/lib/ark/getCollectionTokens";
import type { Filters } from "@/types";

import { getCollectionTokens } from "@/lib/ark/getCollectionTokens";

interface useCollectionTokensProps {
  collectionAddress: string;
  sortBy: CollectionSortBy;
  sortDirection: CollectionSortDirection;
  filters: Filters;
  buyNow:boolean;
}

const REFETCH_INTERVAL = 10_000;

export default function useCollectionTokens({ collectionAddress, sortDirection, sortBy, filters, buyNow }: useCollectionTokensProps) {
  const result = useSuspenseInfiniteQuery({
    queryKey: [
      "collectionTokens",
      sortDirection,
      sortBy,
      collectionAddress,
      filters,
      buyNow
    ],
    refetchInterval: REFETCH_INTERVAL,
    getNextPageParam: (lastPage: CollectionTokensApiResponse) =>
      lastPage.next_page,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      getCollectionTokens({
        collectionAddress,
        page: pageParam,
        sortDirection,
        sortBy,
        filters,
        buyNow
      }),
  });
  return result;
}