import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import { PurchaseDialog } from "@/components/modules/marketplace-sweep-dialog";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import { Button } from "@/components/ui/button";
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
import { marketplaceAddress, marketplaceCollections } from "@/config";
import { fetchCollectionStatistics, fetchOpenOrdersByPrice, OpenOrderByPrice } from "@/hooks/services";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { useDebounce } from "@bibliothecadao/react";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Grid2X2, Grid3X3, Loader2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { env } from "../../../../env";

export const Route = createLazyFileRoute("/trade/$collection/")({
  component: CollectionPage,
  pendingComponent: FullPageLoader,
});

function CollectionPage() {
  const { collection } = Route.useParams();
  const collectionAddress = marketplaceCollections[collection as keyof typeof marketplaceCollections].address;
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [openOrdersByPrice, totals] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["openOrdersByPrice", marketplaceAddress, collection],
        queryFn: () =>
          fetchOpenOrdersByPrice(collectionAddress, undefined, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE),
        refetchInterval: 8_000,
      },
      {
        queryKey: ["activeMarketOrdersTotal", collection],
        queryFn: () => fetchCollectionStatistics(collectionAddress),
        refetchInterval: 30_000,
      },
    ],
  });

  const getMetadataString = useCallback((item: OpenOrderByPrice) => {
    if (item?.metadata) {
      return item.metadata;
    }
    return null;
  }, []);
  const {
    selectedFilters,
    allTraits,
    filteredData: filteredItems,
    handleFilterChange: originalHandleFilterChange,
    clearFilter: originalClearFilter,
    clearAllFilters: originalClearAllFilters,
  } = useTraitFiltering<OpenOrderByPrice>(openOrdersByPrice.data, getMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);
  const MAX_VISIBLE_PAGES = 5;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // --- Wrappers for filter functions to reset page ---
  const handleFilterChange = useCallback(
    (traitType: string, value: string) => {
      originalHandleFilterChange(traitType, value);
      setCurrentPage(1);
    },
    [originalHandleFilterChange],
  );

  const clearFilter = useCallback(
    (traitType: string) => {
      originalClearFilter(traitType);
      setCurrentPage(1);
    },
    [originalClearFilter],
  );

  const clearAllFilters = useCallback(() => {
    originalClearAllFilters();
    setCurrentPage(1);
  }, [originalClearAllFilters]);

  const [isCompactGrid, setIsCompactGrid] = useState(true);
  const { selectedPasses, togglePass, clearSelection, getTotalPrice } = useSelectedPassesStore();
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [sweepCount, setSweepCount] = useState(0);
  const debouncedSweepCount = useDebounce(sweepCount, 200);

  const isSeasonPassEndSeason = collection === "season-passes" && env.VITE_PUBLIC_SHOW_END_GAME_WARNING;

  // Update effect to use debounced value
  useEffect(() => {
    if (sweepCount > 0) {
      const itemsToSelect = paginatedItems.slice(0, sweepCount);
      const currentSelectedIds = new Set(selectedPasses.map((pass) => pass.token_id));

      itemsToSelect.forEach((item) => {
        if (!currentSelectedIds.has(item.token_id)) {
          togglePass(item);
        }
      });

      selectedPasses.forEach((pass) => {
        if (!itemsToSelect.some((p) => p.token_id === pass.token_id)) {
          togglePass(pass);
        }
      });
    }
  }, [sweepCount, paginatedItems, selectedPasses, togglePass]);

  // Reset sweep count only when manually selecting passes
  useEffect(() => {
    if (
      selectedPasses.length > 0 &&
      sweepCount > 0 &&
      selectedPasses.length !== sweepCount &&
      debouncedSweepCount === sweepCount
    ) {
      setSweepCount(0);
    }
  }, [selectedPasses.length, sweepCount, debouncedSweepCount]);

  const totalItems = filteredItems.length;
  const activeOrders = totals.data?.[0]?.active_order_count ?? 0;

  return (
    <>
      {isSeasonPassEndSeason ? (
        <div className="text-lg border px-4 py-2 flex items-center gap-2 mt-2 mx-6">
          <AlertTriangle className="w-4 h-4" />
          <p>The current season has ended and Season 1 Passes can no longer be used in Eternum.</p>
        </div>
      ) : (
        <>
          <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
            {isHeaderScrolled ? <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">{collection}</h4> : <div></div>}
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

          <div className="flex-1">
            <div className="flex flex-col gap-2 px-2">
              <Suspense
                fallback={
                  <div className="flex-grow flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                }
              >
                {filteredItems.length > 0 && (
                  <CollectionTokenGrid
                    tokens={paginatedItems}
                    isCompactGrid={isCompactGrid}
                    onToggleSelection={togglePass}
                  />
                )}

                {filteredItems.length === 0 && Object.keys(selectedFilters).length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">No items match the selected filters.</div>
                )}
                {totalItems === 0 && <div className="text-center py-6 text-muted-foreground">No items available.</div>}
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
                      <div className="flex -space-x-2">
                        {selectedPasses.slice(0, 3).map((pass) => {
                          const metadata = pass.metadata;
                          const image = metadata?.image;
                          return (
                            <div
                              key={pass.token_id}
                              className="relative w-10 h-10 rounded-full border-2 border-background overflow-hidden"
                            >
                              <img src={image} alt={`Item #${pass.token_id}`} className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
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
                    Buy ({selectedPasses.length}) Items
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
                  {Array.from({ length: Math.min(MAX_VISIBLE_PAGES, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pageNumber);
                          }}
                          isActive={currentPage === pageNumber}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
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

          <PurchaseDialog isOpen={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen} />
        </>
      )}
    </>
  );
}
