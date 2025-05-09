import { FullPageLoader } from "@/components/modules/full-page-loader";
import { SeasonPassesGrid } from "@/components/modules/season-passes-grid";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
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
import { GET_ACCOUNT_TOKENS } from "@/hooks/query/erc721";
import { fetchActiveMarketOrdersTotal, fetchOpenOrdersByPrice, OpenOrderByPrice } from "@/hooks/services";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress } from "@/lib/utils";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Grid2X2, Grid3X3, Loader2 } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/season-passes")({
  component: SeasonPasses,
  pendingComponent: FullPageLoader,
});

function SeasonPasses() {
  const { connectors } = useConnect();
  const { address } = useAccount();

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [controllerAddress] = useState<string>();

  const [tokenIdToTransfer, setTokenIdToTransfer] = useState<string | null>(null);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [openOrdersByPrice, totals, myNftsQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["openOrdersByPrice", marketplaceAddress],
        queryFn: () => fetchOpenOrdersByPrice(seasonPassAddress, undefined, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE),
      },
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
    ],
  });

  //const mySeasonPassNfts: TokenBalanceEdge[] = useMemo(() => getSeasonPassNfts(myNftsQuery.data), [myNftsQuery.data]);

  const getSeasonPassMetadataString = useCallback((pass: OpenOrderByPrice): string | null => {
    if (pass?.metadata) {
      return pass.metadata;
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
  } = useTraitFiltering<OpenOrderByPrice>(openOrdersByPrice.data, getSeasonPassMetadataString);

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
  const handleTransferClick = useCallback((tokenId?: string) => {
    if (tokenId) {
      setTokenIdToTransfer(tokenId);
    }
    setIsTransferOpen(true);
  }, []);

  const totalPasses = filteredSeasonPasses.length;

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
                    checkOwner={true}
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

        {/*isTransferOpen && (
          <TransferSeasonPassDialog
            isOpen={isTransferOpen}
            setIsOpen={setIsTransferOpen}
            seasonPassMints={mySeasonPassNfts as SeasonPassMint[]}
            initialSelectedTokenId={tokenIdToTransfer}
          />
        )*/}
      </>
    </div>
  );
}
