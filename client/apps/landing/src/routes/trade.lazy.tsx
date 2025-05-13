import { FullPageLoader } from "@/components/modules/full-page-loader";
import { PurchaseDialog } from "@/components/modules/marketplace-sweep-dialog";
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
import { Slider } from "@/components/ui/slider";
import { marketplaceAddress, seasonPassAddress } from "@/config";
import { fetchActiveMarketOrdersTotal, fetchOpenOrdersByPrice, OpenOrderByPrice } from "@/hooks/services";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress } from "@/lib/utils";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { useDebounce } from "@bibliothecadao/react";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Grid2X2, Grid3X3, Loader2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
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

  const [openOrdersByPrice, totals] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["openOrdersByPrice", marketplaceAddress],
        queryFn: () =>
          fetchOpenOrdersByPrice(seasonPassAddress, undefined, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE),
        refetchInterval: 8_000,
      },
      {
        queryKey: ["activeMarketOrdersTotal", seasonPassAddress],
        queryFn: () => fetchActiveMarketOrdersTotal(seasonPassAddress),
        refetchInterval: 30_000,
      },
    ],
  });

  //const mySeasonPassNfts: TokenBalanceEdge[] = useMemo(() => getSeasonPassNfts(myNftsQuery.data), [myNftsQuery.data]);

  const getSeasonPassMetadataString = useCallback((pass: OpenOrderByPrice) => {
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
  const activeOrders = totals.data?.[0]?.active_order_count ?? 0;
  const totalWeiStr = BigInt(totals.data?.[0]?.open_orders_total_wei ?? 0);
  const totalWei = formatUnits(totalWeiStr, 18);
  const totalEth = totalWei ?? "0";
  const [isCompactGrid, setIsCompactGrid] = useState(true);

  // Replace the selection state with the store
  const { selectedPasses, togglePass, clearSelection, getTotalPrice } = useSelectedPassesStore();

  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [sweepCount, setSweepCount] = useState(0);
  const debouncedSweepCount = useDebounce(sweepCount, 200); // 300ms debounce

  // Update effect to use debounced value
  useEffect(() => {
    // Only run sweep selection if sweepCount > 0
    if (sweepCount > 0) {
      // Get the passes we want to select
      const passesToSelect = paginatedPasses.slice(0, sweepCount);

      // Get current selected pass IDs
      const currentSelectedIds = new Set(selectedPasses.map((pass) => pass.token_id));

      // Toggle passes that need to be selected
      passesToSelect.forEach((pass) => {
        if (!currentSelectedIds.has(pass.token_id)) {
          togglePass(pass);
        }
      });

      // Toggle passes that need to be deselected
      selectedPasses.forEach((pass) => {
        if (!passesToSelect.some((p) => p.token_id === pass.token_id)) {
          togglePass(pass);
        }
      });
    }
  }, [sweepCount, paginatedPasses, selectedPasses, togglePass]);

  // Reset sweep count only when manually selecting passes
  useEffect(() => {
    // Only reset if we have selected passes and sweep count is > 0
    // AND the selection count doesn't match the sweep count (indicating manual selection)
    // AND we're not in the middle of a sweep operation (debouncedSweepCount matches sweepCount)
    if (
      selectedPasses.length > 0 &&
      sweepCount > 0 &&
      selectedPasses.length !== sweepCount &&
      debouncedSweepCount === sweepCount
    ) {
      setSweepCount(0);
    }
  }, [selectedPasses.length, sweepCount, debouncedSweepCount]);

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
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{"Season 1 Pass Marketplace"}</h2>
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
          <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
            {/* Filter UI */}
            {isHeaderScrolled ? (
              <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">{"Season 1 Pass"}</h4>
            ) : (
              <div></div>
            )}
            <div className="flex justify-end my-2 gap-1 sm:gap-4 px-4 items-center">
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
                className="hidden sm:flex"
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
                    onToggleSelection={togglePass}
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

          {/* Sticky Bottom Sweep Bar */}
          <div className="sticky bottom-0 left-0 right-0 bg-background border-t py-2 px-4 shadow-lg">
            <div className="container mx-auto flex gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedPasses.length > 0 && sweepCount === 0 && !debouncedSweepCount ? (
                    <div className="flex items-center gap-2">
                      {/* Selected Pass Images */}
                      <div className="flex -space-x-2">
                        {selectedPasses.slice(0, 3).map((pass) => {
                          const metadata = pass.metadata;
                          const image = metadata?.image;
                          return (
                            <div
                              key={pass.token_id}
                              className="relative w-10 h-10 rounded-full border-2 border-background overflow-hidden"
                            >
                              <img src={image} alt={`Pass #${pass.token_id}`} className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
                      {/* Show count if more than 3 passes */}
                      {selectedPasses.length > 3 && (
                        <span className="text-sm font-medium text-muted-foreground">
                          +{selectedPasses.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 w-32 sm:w-52 -mt-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">Sweep Selection</span>
                          <span className="text-xs text-muted-foreground">
                            {sweepCount} / {Math.min(activeOrders, 24)}
                          </span>
                        </div>
                        <Slider
                          value={[sweepCount]}
                          onValueChange={([value]: number[]) => setSweepCount(value)}
                          max={Math.min(activeOrders, 24)}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                  <Button className="mr-4" onClick={() => setIsPurchaseDialogOpen(true)}>
                    Buy ({selectedPasses.length}) Passes
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:block font-semibold">
                    {getTotalPrice()} Lords{" "}
                    <span className="text-xs text-muted-foreground">
                      (Max Price:{" "}
                      {selectedPasses.length > 0
                        ? formatUnits(
                            BigInt(Math.max(...selectedPasses.map((pass) => Number(pass.best_price_hex)))),
                            18,
                          )
                        : 0}
                      )
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSweepCount(0);
                      clearSelection();
                    }}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
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

      <PurchaseDialog isOpen={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen} />
    </div>
  );
}
