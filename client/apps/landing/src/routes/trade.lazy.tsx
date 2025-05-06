import { FullPageLoader } from "@/components/modules/full-page-loader";
import { SeasonPassesGrid } from "@/components/modules/season-passes-grid";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import TransferSeasonPassDialog from "@/components/modules/transfer-season-pass-dialog";
import { Button } from "@/components/ui/button";
import { ResourceIcon } from "@/components/ui/elements/resource-icon";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollHeader } from "@/components/ui/scroll-header";
import { marketplaceAddress, seasonPassAddress } from "@/config";
import { execute } from "@/hooks/gql/execute";
import { GetAccountTokensQuery, GetAllTokensQuery } from "@/hooks/gql/graphql";
import { GET_ACCOUNT_TOKENS, GET_ALL_TOKENS, GET_MARKETPLACE_ORDERS } from "@/hooks/query/erc721";
import { fetchActiveMarketOrdersTotal } from "@/hooks/services";
import { useTransferState } from "@/hooks/use-transfer-state";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress } from "@/lib/utils";
import { SeasonPassMint } from "@/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Grid2X2, Grid3X3, Loader2 } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";
import { formatUnits } from "viem";
import { MarketOrder, MergedNftData } from "./season-passes.lazy";

export const Route = createLazyFileRoute("/season-passes")({
  component: SeasonPasses,
  pendingComponent: FullPageLoader,
});
export type TokenBalance = NonNullable<NonNullable<GetAccountTokensQuery["tokenBalances"]>["edges"]>[number];
export type TokenBalanceEdge = NonNullable<NonNullable<GetAccountTokensQuery["tokenBalances"]>["edges"]>[number];
export type AllTokenEdge = NonNullable<NonNullable<GetAllTokensQuery["tokens"]>["edges"]>[number];

// Filter for season pass NFTs from account tokens query
const getSeasonPassNfts = (data: GetAccountTokensQuery | null): TokenBalanceEdge[] => {
  return (
    data?.tokenBalances?.edges?.filter((token): token is TokenBalanceEdge => {
      if (token?.node?.tokenMetadata.__typename !== "ERC721__Token") return false;
      return (
        addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
        addAddressPadding(seasonPassAddress ?? "0x0")
      );
    }) ?? []
  );
};

// Filter for season pass NFTs from all tokens query
const getAllSeasonPassNfts = (data: GetAllTokensQuery | null): AllTokenEdge[] => {
  return (
    data?.tokens?.edges?.filter((token): token is AllTokenEdge => {
      if (token?.node?.tokenMetadata.__typename !== "ERC721__Token") return false;

      return (
        addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
        addAddressPadding(seasonPassAddress ?? "0x0")
      );
    }) ?? []
  );
};

type ViewMode = "all";

function SeasonPasses() {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [controllerAddress] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [tokenIdToTransfer, setTokenIdToTransfer] = useState<string | null>(null);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const { transferableTokenIds } = useTransferState();

  const [totals, myNftsQuery, allNftsQuery, ordersQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["activeMarketOrdersTotal"],
        queryFn: () => fetchActiveMarketOrdersTotal(),
        refetchInterval: 60_000,
      },
      {
        queryKey: ["erc721Balance", address, "seasonPasses"],
        queryFn: () =>
          execute(GET_ACCOUNT_TOKENS, {
            accountAddress: address ?? "",
            offset: 0,
            limit: 1000,
          }),
      },
      {
        queryKey: ["allTokens", "seasonPasses"],
        queryFn: () =>
          execute(GET_ALL_TOKENS, {
            offset: 0,
            limit: 8000,
            contractAddress: seasonPassAddress,
          }),
      },
      {
        queryKey: ["marketplaceOrders", marketplaceAddress],
        queryFn: () => execute(GET_MARKETPLACE_ORDERS, { limit: 8000 }),
        refetchInterval: 15_000,
      },
    ],
  });

  const mySeasonPassNfts: TokenBalanceEdge[] = useMemo(() => getSeasonPassNfts(myNftsQuery.data), [myNftsQuery.data]);

  const allSeasonPassNfts: AllTokenEdge[] = useMemo(
    () => (viewMode === "all" ? getAllSeasonPassNfts(allNftsQuery.data) : []),
    [allNftsQuery.data, viewMode],
  );

  const marketplaceOrdersData = ordersQuery.data as any;

  const processedAndSortedNfts = useMemo((): MergedNftData[] => {
    // Use the appropriate NFT edges based on view mode
    const nftEdges = allSeasonPassNfts;
    // Adjust access based on actual response structure from GET_MARKETPLACE_ORDERS
    const orderEdges = marketplaceOrdersData?.marketplaceMarketOrderModelModels?.edges;

    if (!nftEdges || !orderEdges) return [];

    // 1. Process marketplace orders to find min price per token ID
    const orderInfoMap = new Map<string, { minPrice: bigint; owner: string; orderId: string; expiration: string }>();

    orderEdges.forEach((edge: { node: { order: MarketOrder; order_id: string } } | null) => {
      const order = edge?.node?.order;
      const orderId = edge?.node?.order_id;
      const expiration = order?.expiration;

      // Ensure order exists, is active, and has necessary fields
      // No need to check active here if filtered in query, but good practice
      if (order && order.active && order.token_id && order.price && order.owner && orderId && expiration) {
        const tokenId = order.token_id.toString(); // Ensure consistent format (e.g., string)
        const price = BigInt(order.price);
        const owner = order.owner;

        const existingOrderInfo = orderInfoMap.get(tokenId);

        if (!existingOrderInfo || price < existingOrderInfo.minPrice) {
          orderInfoMap.set(tokenId, { minPrice: price, owner, orderId, expiration });
        }
      }
    });

    // 2. Merge order info with NFT data
    const mergedNftsWithNulls = nftEdges.map((nftEdge: TokenBalanceEdge | AllTokenEdge | null) => {
      const nftNode = nftEdge?.node;
      // Ensure node exists and metadata is of type ERC721__Token
      if (!nftNode || nftNode.tokenMetadata.__typename !== "ERC721__Token") return null;

      const tokenId = nftNode.tokenMetadata.tokenId.toString(); // Access tokenId correctly
      const orderInfo = orderInfoMap.get(parseInt(tokenId).toString());

      return {
        node: nftNode, // Keep the original NFT node structure
        minPrice: orderInfo ? orderInfo.minPrice : null,
        marketplaceOwner: orderInfo ? orderInfo.owner : null,
        expiration: orderInfo ? orderInfo.expiration : null,
        orderId: orderInfo ? orderInfo.orderId : null,
        owner: orderInfo ? orderInfo.owner : null,
      };
    });

    // Type guard for filtering out nulls and ensuring correct type
    const mergedNfts = mergedNftsWithNulls.filter(
      (nft): nft is any => nft !== null && nft.node?.tokenMetadata?.__typename === "ERC721__Token",
    );

    // 3. Sort the merged NFTs: transferable last, then by price (lowest first, unlisted last)
    mergedNfts.sort((a, b) => {
      const aTokenId = a.node.tokenMetadata.tokenId.toString();
      const bTokenId = b.node.tokenMetadata.tokenId.toString();

      const isATransferable = transferableTokenIds.has(parseInt(aTokenId).toString());
      const isBTransferable = transferableTokenIds.has(parseInt(bTokenId).toString());

      // Prioritize non-transferable items first
      if (isATransferable && !isBTransferable) return 1; // a comes after b
      if (!isATransferable && isBTransferable) return -1; // a comes before b

      // If both are transferable or both are not, sort by price
      const priceA = a.minPrice;
      const priceB = b.minPrice;

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1; // Unlisted (null price) come last among non-transferable/transferable groups
      if (priceB === null) return -1;
      if (priceA < priceB) return -1;
      if (priceA > priceB) return 1;
      return 0;
    });

    return mergedNfts;
  }, [viewMode, mySeasonPassNfts, allSeasonPassNfts, marketplaceOrdersData, transferableTokenIds]);

  const getSeasonPassMetadataString = useCallback((pass: TokenBalanceEdge | AllTokenEdge): string | null => {
    if (pass?.node?.tokenMetadata?.__typename === "ERC721__Token") {
      return pass.node.tokenMetadata.metadata;
    }
    return null;
  }, []);

  const {
    selectedFilters,
    allTraits,
    filteredData: filteredSeasonPasses,
    handleFilterChange: originalHandleFilterChange,
    clearFilter: originalClearFilter,
    clearAllFilters: originalClearAllFilters,
  } = useTraitFiltering<MergedNftData>(processedAndSortedNfts, getSeasonPassMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredSeasonPasses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPasses = filteredSeasonPasses.slice(startIndex, endIndex);
  const MAX_VISIBLE_PAGES = 5; // Define the maximum number of page links to show

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // --- Wrappers for filter functions to reset page ---
  const handleFilterChange = useCallback(
    (traitType: string, value: string) => {
      originalHandleFilterChange(traitType, value);
      setCurrentPage(1); // Reset page
    },
    [originalHandleFilterChange],
  );

  const clearFilter = useCallback(
    (traitType: string) => {
      originalClearFilter(traitType);
      setCurrentPage(1); // Reset page
    },
    [originalClearFilter],
  );

  const clearAllFilters = useCallback(() => {
    originalClearAllFilters();
    setCurrentPage(1); // Reset page
  }, [originalClearAllFilters]);

  // Function to generate pagination items with ellipsis
  const renderPaginationItems = () => {
    const items = [];
    const startPage = Math.max(1, currentPage - Math.floor(MAX_VISIBLE_PAGES / 2));
    const endPage = Math.min(totalPages, startPage + MAX_VISIBLE_PAGES - 1);

    // Adjust startPage if endPage is at the maximum
    const adjustedStartPage = Math.max(1, endPage - MAX_VISIBLE_PAGES + 1);

    // "First" page link
    if (adjustedStartPage > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(1);
            }}
          >
            1
          </PaginationLink>
        </PaginationItem>,
      );
      if (adjustedStartPage > 2) {
        items.push(
          <PaginationItem key="start-ellipsis">
            <span className="px-3 py-1.5">...</span>
          </PaginationItem>,
        );
      }
    }

    // Page number links
    for (let i = adjustedStartPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(i);
            }}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    // "Last" page link
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="end-ellipsis">
            <span className="px-3 py-1.5">...</span>
          </PaginationItem>,
        );
      }
      items.push(
        <PaginationItem key="last">
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    return items;
  };

  // Only allow transfer for user's own tokens
  const handleTransferClick = useCallback(
    (tokenId?: string) => {
      if (tokenId) {
        setTokenIdToTransfer(tokenId);
      }
      setIsTransferOpen(true);
    },
    [viewMode],
  );

  const totalPasses = allSeasonPassNfts.length;

  const activeOrders = totals.data?.[0]?.total_active ?? 0;
  const totalWei = totals.data?.[0]?.total_volume ?? null;
  const totalEth = totalWei !== null ? formatUnits(totalWei, 18) : "0";
  const [isCompactGrid, setIsCompactGrid] = useState(true);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <>
        {controllerAddress && (
          <div className="text-xl py-4 flex items-center">
            Minting to:{" "}
            <Badge fontVariant="secondary" className="text-lg ml-4 py-1.5">
              <img className="w-6 pr-2" src={connectors[2].icon as string} alt="Connector Icon" />
              {displayAddress(controllerAddress)}
            </Badge>
          </div>
        )}

        <div className="flex flex-col h-full overflow-y-auto">
          <div className="text-center border-b py-6">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{"Season Pass Marketplace"}</h2>
            <div className="flex justify-center items-center gap-4 text-xl text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{activeOrders}</span> Active Listings
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                Volume <span className="font-semibold text-foreground">{parseFloat(totalEth).toLocaleString()}</span>{" "}
                <ResourceIcon resource="Lords" size="sm" />
              </span>
            </div>
          </div>
          <ScrollHeader>
            {/* Filter UI */}
            <div className="flex justify-end my-2 gap-4 px-4">
              <TraitFilterUI
                allTraits={allTraits}
                selectedFilters={selectedFilters}
                handleFilterChange={handleFilterChange}
                clearFilter={clearFilter}
                clearAllFilters={clearAllFilters}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCompactGrid(!isCompactGrid)}
                title={isCompactGrid ? "Switch to larger grid" : "Switch to compact grid"}
              >
                {isCompactGrid ? <Grid3X3 className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
              </Button>
            </div>
          </ScrollHeader>

          {/* Scrollable content area */}
          <div className="flex-1">
            <div className="flex flex-col gap-2 px-2">
              <Suspense
                fallback={
                  <div className="flex-grow flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                }
              >
                {filteredSeasonPasses.length > 0 && (
                  <SeasonPassesGrid
                    seasonPasses={paginatedPasses}
                    setIsTransferOpen={handleTransferClick}
                    hideTransferButton={true}
                    isCompactGrid={isCompactGrid}
                  />
                )}

                {filteredSeasonPasses.length === 0 && Object.keys(selectedFilters).length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    No Season Passes match the selected filters.
                  </div>
                )}
                {totalPasses === 0 && (
                  <div className="text-center py-6 text-muted-foreground">No Season Pass NFTs available.</div>
                )}
              </Suspense>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex-shrink-0">
              <Pagination className="py-2 border-t">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                  {renderPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {isTransferOpen && (
          <TransferSeasonPassDialog
            isOpen={isTransferOpen}
            setIsOpen={setIsTransferOpen}
            seasonPassMints={mySeasonPassNfts as SeasonPassMint[]}
            initialSelectedTokenId={tokenIdToTransfer}
          />
        )}
      </>
    </div>
  );
}
