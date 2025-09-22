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
import { Slider } from "@/components/ui/slider";
import { marketplaceAddress, marketplaceCollections } from "@/config";
import {
  fetchAllCollectionTokens,
  FetchAllCollectionTokensOptions,
  fetchCollectionStatistics,
  fetchCollectionTraits,
} from "@/hooks/services";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { useDebounce } from "@bibliothecadao/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Grid2X2, Grid3X3, Loader2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { env } from "../../../../env";

export const Route = createLazyFileRoute("/trade/$collection/")({
  component: CollectionPage,
  pendingComponent: FullPageLoader,
});

function CollectionPage() {
  const { collection } = Route.useParams();
  const navigate = useNavigate();
  const collectionConfig = marketplaceCollections[collection as keyof typeof marketplaceCollections];
  const collectionAddress = collectionConfig.address;

  const enforcedTraitFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(collectionConfig.defaultTraitFilters ?? {}).map(([trait, values]) => [trait, [...values]]),
      ),
    [collectionConfig],
  );

  const applyEnforcedFilters = useCallback(
    (filters: Record<string, string[]>) => {
      const nextFilters: Record<string, string[]> = {};

      Object.entries(filters).forEach(([trait, values]) => {
        if (values.length > 0) {
          nextFilters[trait] = [...values];
        }
      });

      Object.entries(enforcedTraitFilters).forEach(([trait, values]) => {
        if (values.length === 0) return;
        const existing = new Set(nextFilters[trait] ?? []);
        values.forEach((value) => existing.add(value));
        nextFilters[trait] = Array.from(existing);
      });

      return nextFilters;
    },
    [enforcedTraitFilters],
  );

  // --- State Management ---
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(() => applyEnforcedFilters({}));
  const [sortBy, setSortBy] = useState<FetchAllCollectionTokensOptions["sortBy"]>("price_asc");
  const [listedOnly, setListedOnly] = useState(false);
  const ITEMS_PER_PAGE = 24;

  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounce(selectedFilters, 300);
  const debouncedSortBy = useDebounce(sortBy, 300);
  const debouncedListedOnly = useDebounce(listedOnly, 300);

  // --- API Queries ---
  const totals = useSuspenseQuery({
    queryKey: ["activeMarketOrdersTotal", collection],
    queryFn: () => fetchCollectionStatistics(collectionAddress),
    refetchInterval: 30_000,
  });

  // Fetch tokens with server-side filtering and pagination
  const tokenOptions: FetchAllCollectionTokensOptions = useMemo(
    () => ({
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
      traitFilters: debouncedFilters,
      sortBy: debouncedSortBy,
      listedOnly: debouncedListedOnly,
    }),
    [currentPage, debouncedFilters, debouncedSortBy, debouncedListedOnly, ITEMS_PER_PAGE],
  );

  const tokensQuery = useQuery({
    queryKey: ["allCollectionTokens", marketplaceAddress, collection, tokenOptions],
    queryFn: () => fetchAllCollectionTokens(collectionAddress, tokenOptions),
    refetchInterval: 8_000,
  });

  // Get all traits for filter UI efficiently
  const allTraitsQuery = useQuery({
    queryKey: ["collectionTraits", marketplaceAddress, collection],
    queryFn: () => fetchCollectionTraits(collectionAddress),
    refetchInterval: 300_000, // Very infrequent updates (5 minutes) since traits don't change often
    staleTime: 300_000, // Consider data fresh for 5 minutes
  });

  // --- Derived State ---
  const tokens = useMemo(() => tokensQuery.data?.tokens ?? [], [tokensQuery.data?.tokens]);
  const totalItems = tokensQuery.data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const activeOrders = totals.data?.[0]?.active_order_count ?? 0;
  const allTraits = allTraitsQuery.data ?? {};
  const MAX_VISIBLE_PAGES = 5;
  const listedTokensOnPage = useMemo(
    () => tokens.filter((token) => token.expiration !== null && token.best_price_hex !== null),
    [tokens],
  );

  // --- Event Handlers ---
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = useCallback(
    (traitType: string, value: string) => {
      setSelectedFilters((prev) => {
        const currentValues = prev[traitType] || [];
        const newValues = currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value];

        const nextFilters = { ...prev };

        if (newValues.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [traitType]: _, ...rest } = nextFilters;
          return applyEnforcedFilters(rest);
        }

        nextFilters[traitType] = newValues;
        return applyEnforcedFilters(nextFilters);
      });
      setCurrentPage(1); // Reset to first page when filters change
    },
    [applyEnforcedFilters],
  );

  const clearFilter = useCallback(
    (traitType: string) => {
      setSelectedFilters((prev) => {
        const { [traitType]: _, ...rest } = prev;
        return applyEnforcedFilters(rest);
      });
      setCurrentPage(1);
    },
    [applyEnforcedFilters],
  );

  const clearAllFilters = useCallback(() => {
    setSelectedFilters(applyEnforcedFilters({}));
    setCurrentPage(1);
  }, [applyEnforcedFilters]);

  const [isCompactGrid, setIsCompactGrid] = useState(true);
  const { selectedPasses, togglePass, clearSelection, getTotalPrice } = useSelectedPassesStore(
    "$collection" + collection,
  );
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [sweepCount, setSweepCount] = useState(0);
  const debouncedSweepCount = useDebounce(sweepCount, 200);

  const isSeasonPassEndSeason = collection === "season-passes" && env.VITE_PUBLIC_SHOW_END_GAME_WARNING;

  // Auto-redirect to activity tab if season has ended for season passes
  useEffect(() => {
    if (isSeasonPassEndSeason) {
      navigate({ to: `/trade/$collection/activity`, params: { collection } });
    }
  }, [isSeasonPassEndSeason, navigate, collection]);

  useEffect(() => {
    setSelectedFilters(applyEnforcedFilters({}));
  }, [applyEnforcedFilters]);

  // Update effect to use debounced value
  useEffect(() => {
    if (sweepCount > 0 && tokens.length > 0) {
      // Only select from listed items
      const listedTokens = tokens.filter((token) => token.expiration !== null && token.best_price_hex !== null);
      const itemsToSelect = listedTokens.slice(0, sweepCount);
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
  }, [sweepCount, tokens, selectedPasses, togglePass]);

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

  return (
    <>
      {isSeasonPassEndSeason ? (
        <div className="text-lg border px-4 py-2 flex items-center gap-2 mt-2 mx-6">
          <AlertTriangle className="w-4 h-4" />
          <p>The current season has ended and Season 1 Passes can no longer be used in Eternum.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-row justify-between items-center mb-4 px-4">
            <div></div>
            <div className="flex justify-end my-2 gap-1 sm:gap-4 items-center">
              {Object.keys(allTraits).length > 0 && (
                <TraitFilterUI
                  allTraits={allTraits}
                  selectedFilters={selectedFilters}
                  handleFilterChange={handleFilterChange}
                  clearFilter={clearFilter}
                  clearAllFilters={clearAllFilters}
                />
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as FetchAllCollectionTokensOptions["sortBy"])}
                className="px-3 py-1 rounded border text-sm bg-background"
                title="Sort by"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="token_id_asc">Token ID: Low to High</option>
                <option value="token_id_desc">Token ID: High to Low</option>
              </select>
              <Button
                variant={listedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setListedOnly(!listedOnly)}
                title="Show only listed items"
                className="hidden sm:flex"
              >
                Listed Only
              </Button>
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
          </div>

          <div className="flex-1">
            <div className="flex flex-col gap-2 px-2">
              <Suspense
                fallback={
                  <div className="flex-grow flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                }
              >
                {tokensQuery.isLoading && (
                  <div className="flex-grow flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                )}

                {!tokensQuery.isLoading && tokens.length > 0 && (
                  <CollectionTokenGrid
                    tokens={tokens}
                    isCompactGrid={isCompactGrid}
                    onToggleSelection={(pass) => {
                      // Only allow listed items to be selected
                      const isListed = pass.expiration !== null && pass.best_price_hex !== null;
                      if (isListed) {
                        togglePass(pass);
                      }
                    }}
                    pageId={`$collection${collection}`}
                  />
                )}

                {!tokensQuery.isLoading && tokens.length === 0 && Object.keys(selectedFilters).length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">No items match the selected filters.</div>
                )}
                {!tokensQuery.isLoading && totalItems === 0 && Object.keys(selectedFilters).length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">No items available.</div>
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
                      <div className="flex -space-x-2">
                        {selectedPasses.slice(0, 3).map((pass) => {
                          const metadata = pass.metadata;
                          const image = metadata?.image?.startsWith("ipfs://")
                            ? metadata?.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
                            : metadata?.image;
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
                            {sweepCount} / {listedTokensOnPage.length}
                          </span>
                        </div>
                        <Slider
                          value={[sweepCount]}
                          onValueChange={([value]: number[]) => setSweepCount(value)}
                          max={listedTokensOnPage.length}
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
                  {(() => {
                    const startPage = Math.max(1, currentPage - Math.floor(MAX_VISIBLE_PAGES / 2));
                    const endPage = Math.min(totalPages, startPage + MAX_VISIBLE_PAGES - 1);
                    const adjustedStartPage = Math.max(1, endPage - MAX_VISIBLE_PAGES + 1);

                    return Array.from({ length: endPage - adjustedStartPage + 1 }, (_, i) => {
                      const pageNumber = adjustedStartPage + i;
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
                    });
                  })()}
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

          <PurchaseDialog
            isOpen={isPurchaseDialogOpen}
            onOpenChange={setIsPurchaseDialogOpen}
            collection={collection}
          />
        </>
      )}
    </>
  );
}
