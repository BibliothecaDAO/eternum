import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
import { SeasonPassesGrid } from "@/components/modules/season-passes-grid";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import TransferSeasonPassDialog from "@/components/modules/transfer-season-pass-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { marketplaceAddress, seasonPassAddress } from "@/config";
import { execute } from "@/hooks/gql/execute";
import { GetAccountTokensQuery, GetAllTokensQuery } from "@/hooks/gql/graphql";
import { GET_ACCOUNT_TOKENS, GET_ALL_TOKENS, GET_MARKETPLACE_ORDERS } from "@/hooks/query/erc721";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress } from "@/lib/utils";
import { SeasonPassMint } from "@/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Loader2 } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

interface MarketOrder {
  active: boolean;
  token_id: string;
  collection_id: string;
  owner: string;
  price: string;
  expiration: string;
}

export interface MergedNftData {
  node: {
    tokenMetadata: {
      __typename: "ERC721__Token";
      tokenId: string;
      metadataDescription?: string | null;
      imagePath: string;
      contractAddress: string;
      metadata: string;
    };
  };
  minPrice: bigint | null;
  marketplaceOwner: string | null;
  orderId: string | null;
  expiration: string | null;
}

export const Route = createLazyFileRoute("/season-passes")({
  component: SeasonPasses,
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

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [myNftsQuery, allNftsQuery, ordersQuery] = useSuspenseQueries({
    queries: [
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
            limit: 1000,
            contractAddress: seasonPassAddress,
          }),
      },
      {
        queryKey: ["marketplaceOrders", marketplaceAddress],
        queryFn: () => execute(GET_MARKETPLACE_ORDERS),
        refetchInterval: 15_000,
      },
    ],
  });

  console.log("allNftsQuery.data", allNftsQuery.data);
  console.log("myNftsQuery.data", myNftsQuery.data);

  const mySeasonPassNfts: TokenBalanceEdge[] = useMemo(() => getSeasonPassNfts(myNftsQuery.data), [myNftsQuery.data]);

  const allSeasonPassNfts: AllTokenEdge[] = useMemo(
    () => (viewMode === "all" ? getAllSeasonPassNfts(allNftsQuery.data) : []),
    [allNftsQuery.data, viewMode],
  );

  const marketplaceOrdersData = ordersQuery.data as any;
  const isLoading = (viewMode === "all" && allNftsQuery.isLoading) || ordersQuery.isLoading;

  console.log("mySeasonPassNfts", mySeasonPassNfts);
  console.log("allSeasonPassNfts", allSeasonPassNfts);

  const processedAndSortedNfts = useMemo((): MergedNftData[] => {
    // Use the appropriate NFT edges based on view mode
    const nftEdges = allSeasonPassNfts;
    // Adjust access based on actual response structure from GET_MARKETPLACE_ORDERS
    const orderEdges = marketplaceOrdersData?.marketplaceMarketOrderModelModels?.edges;

    console.log("orderEdges", orderEdges);
    console.log("nftEdges", nftEdges);

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
      };
    });

    // Type guard for filtering out nulls and ensuring correct type
    const mergedNfts = mergedNftsWithNulls.filter(
      (nft): nft is any => nft !== null && nft.node?.tokenMetadata?.__typename === "ERC721__Token",
    );

    // 3. Sort the merged NFTs by price (lowest first, unlisted last)
    mergedNfts.sort((a, b) => {
      const priceA = a.minPrice;
      const priceB = b.minPrice;

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      if (priceA < priceB) return -1;
      if (priceA > priceB) return 1;
      return 0;
    });

    return mergedNfts;
  }, [viewMode, mySeasonPassNfts, allSeasonPassNfts, marketplaceOrdersData]);

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
    handleFilterChange,
    clearFilter,
    clearAllFilters,
  } = useTraitFiltering<MergedNftData>(processedAndSortedNfts, getSeasonPassMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredSeasonPasses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPasses = filteredSeasonPasses.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Only allow transfer for user's own tokens
  const handleTransferClick = useCallback(() => {
    setIsTransferOpen(true);
  }, [viewMode]);

  if (!address) {
    return <ConnectWalletPrompt connectors={connectors} connect={connect} />;
  }

  const totalPasses = allSeasonPassNfts.length;

  return (
    <div className="flex flex-col h-full">
      {isLoading && (
        <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      )}
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

        <>
          {/* Page Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">{"All Season Passes"}</h2>
          <p className="text-center text-muted-foreground mb-6">{"Browse all available Season Pass NFTs."}</p>

          {/* Filter UI */}
          <div className="px-4">
            <TraitFilterUI
              allTraits={allTraits}
              selectedFilters={selectedFilters}
              handleFilterChange={handleFilterChange}
              clearFilter={clearFilter}
              clearAllFilters={clearAllFilters}
            />
          </div>

          {/* Grid container - Removed extra bottom padding */}
          <div className="flex-grow overflow-y-auto pt-0 px-2">
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton>Loading</Skeleton>}>
                {filteredSeasonPasses.length > 0 && (
                  <SeasonPassesGrid seasonPasses={paginatedPasses} setIsTransferOpen={handleTransferClick} />
                )}

                {filteredSeasonPasses.length === 0 && Object.keys(selectedFilters).length > 0 && !isLoading && (
                  <div className="text-center py-6 text-muted-foreground">
                    No Season Passes match the selected filters.
                  </div>
                )}
                {totalPasses === 0 && !isLoading && (
                  <div className="text-center py-6 text-muted-foreground">No Season Pass NFTs available.</div>
                )}
              </Suspense>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Pagination className="mt-4 pb-4">
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
                {/* Pagination Links */}
                {[...Array(totalPages)].map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(i + 1);
                      }}
                      isActive={currentPage === i + 1}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
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
          )}
          {/* End Pagination Controls */}

          {isTransferOpen && (
            <TransferSeasonPassDialog
              isOpen={isTransferOpen}
              setIsOpen={setIsTransferOpen}
              seasonPassMints={mySeasonPassNfts as SeasonPassMint[]}
            />
          )}
        </>
      </>
    </div>
  );
}
