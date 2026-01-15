import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import { PurchaseDialog } from "@/components/modules/marketplace-sweep-dialog";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { STORAGE_KEYS } from "@/constants/storage";
import { ITEMS_PER_PAGE, MAX_VISIBLE_PAGES } from "@/constants/ui";
import {
  clearCollectionTraitsCache,
  fetchAllCollectionTokens,
  FetchAllCollectionTokensOptions,
  fetchCollectionStatistics,
  fetchCollectionTraits,
} from "@/hooks/services";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { useDebounce } from "@bibliothecadao/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { env } from "../../../../env";

export const Route = createLazyFileRoute("/trade/$collection/")({
  component: CollectionPage,
  pendingComponent: FullPageLoader,
});

// Visible constants moved to '@/constants/ui'

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
  const [listedOnly, setListedOnly] = useState(true);
  const [hideInvalid, setHideInvalid] = useState(false);

  // Persist listedOnly per collection in localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEYS.listedOnly(collectionAddress));
      if (saved !== null) {
        setListedOnly(saved === "1");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddress]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.listedOnly(collectionAddress), listedOnly ? "1" : "0");
    } catch {}
  }, [collectionAddress, listedOnly]);

  // Persist hideInvalid per collection in localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEYS.hideInvalid(collectionAddress));
      if (saved !== null) {
        setHideInvalid(saved === "1");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddress]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.hideInvalid(collectionAddress), hideInvalid ? "1" : "0");
    } catch {}
  }, [collectionAddress, hideInvalid]);

  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounce(selectedFilters, 300);
  const debouncedSortBy = useDebounce(sortBy, 300);
  const debouncedListedOnly = useDebounce(listedOnly, 300);
  const [pageInput, setPageInput] = useState<string>("1");

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
  const allTokens = useMemo(() => tokensQuery.data?.tokens ?? [], [tokensQuery.data?.tokens]);

  // Filter out invalid listings if hideInvalid is enabled
  const tokens = useMemo(() => {
    if (!hideInvalid) return allTokens;

    return allTokens.filter((token) => {
      const listingActive = token.expiration !== null && token.best_price_hex !== null;
      if (!listingActive) return true; // Keep non-listed items

      // Check if listing is invalid (owner mismatch)
      const owner = token.token_owner?.toLowerCase?.();
      const lister = token.order_owner?.toLowerCase?.();
      const isInvalid = listingActive && owner && lister && owner !== lister;

      return !isInvalid; // Keep only valid listings or non-listed items
    });
  }, [allTokens, hideInvalid]);

  const totalItems = tokensQuery.data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const activeOrders = totals.data?.[0]?.active_order_count ?? 0;
  const allTraits = allTraitsQuery.data ?? {};
  const listedTokensOnPage = useMemo(() => {
    return tokens.filter((token) => {
      const listed = token.expiration !== null && token.best_price_hex !== null;
      if (!listed) return false;
      const owner = token.token_owner?.toLowerCase?.();
      const lister = token.order_owner?.toLowerCase?.();
      return owner && lister && owner === lister;
    });
  }, [tokens]);

  console.log({ tokens });

  // --- Event Handlers ---
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Commit inline page input (defined after totalPages and handlePageChange)
  const commitPageInput = useCallback(() => {
    const raw = parseInt(pageInput, 10);
    if (!Number.isNaN(raw)) {
      const page = Math.min(Math.max(raw, 1), Math.max(totalPages, 1));
      handlePageChange(page);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage, handlePageChange]);

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

  // Clamp current page to valid range when totalPages changes
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  // Keep top page input in sync with current page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Reset to first page when switching listed/all or sort (but not hideInvalid - that's a display-only filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [listedOnly, sortBy]);

  // Update effect to use debounced value
  useEffect(() => {
    if (sweepCount > 0 && tokens.length > 0) {
      // Only select from valid listings (listed and current owner matches lister)
      const itemsToSelect = listedTokensOnPage.slice(0, sweepCount);
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
          <p>The current season has ended and Season 1 Passes can no longer be used in Realms.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-4 px-4">
            {/* Filters Section */}
            {Object.keys(allTraits).length > 0 && (
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-end gap-3 justify-between">
                <TraitFilterUI
                  allTraits={allTraits}
                  selectedFilters={selectedFilters}
                  handleFilterChange={handleFilterChange}
                  clearFilter={clearFilter}
                  clearAllFilters={clearAllFilters}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearCollectionTraitsCache(collectionAddress);
                    allTraitsQuery.refetch();
                  }}
                  disabled={allTraitsQuery.isFetching}
                  title="Refresh filter options from blockchain"
                  className="text-xs h-9 px-3 shadow-sm whitespace-nowrap"
                >
                  {allTraitsQuery.isFetching ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Refreshing Filters</span>
                    </span>
                  ) : (
                    <span>Refresh Filters</span>
                  )}
                </Button>
              </div>
            )}

            {/* Controls Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Left Side - View Controls */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as FetchAllCollectionTokensOptions["sortBy"])}
                  className="h-9 px-3 py-1.5 rounded-md border text-xs sm:text-sm bg-background hover:bg-accent/50 transition-colors"
                  title="Sort by"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="token_id_asc">Token ID: Low to High</option>
                  <option value="token_id_desc">Token ID: High to Low</option>
                </select>

                {/* Listed/All Toggle */}
                <div className="flex items-center rounded-md overflow-hidden border shadow-sm">
                  <Button
                    variant={listedOnly ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none text-xs sm:text-sm h-9 px-3"
                    onClick={() => setListedOnly(true)}
                    title="Show listed items only"
                  >
                    Listed
                  </Button>
                  <Button
                    variant={!listedOnly ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none border-l text-xs sm:text-sm h-9 px-3"
                    onClick={() => setListedOnly(false)}
                    title="Show all items (includes unlisted)"
                  >
                    All
                  </Button>
                </div>

                {/* Hide Invalid Checkbox */}
                <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background hover:bg-accent/50 transition-colors space-x-2 shadow-sm">
                  <Checkbox
                    id="hide-invalid"
                    checked={hideInvalid}
                    onCheckedChange={(checked) => setHideInvalid(checked === true)}
                  />
                  <Label
                    htmlFor="hide-invalid"
                    className="text-xs sm:text-sm font-medium leading-none cursor-pointer whitespace-nowrap"
                  >
                    Hide Invalid
                  </Label>
                </div>

                {/* Grid Size Toggle - Desktop Only */}
                <div className="hidden lg:flex items-center rounded-md overflow-hidden border shadow-sm">
                  <Button
                    variant={isCompactGrid ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none text-xs h-9 px-3"
                    onClick={() => setIsCompactGrid(true)}
                    title="Compact grid"
                  >
                    Compact
                  </Button>
                  <Button
                    variant={!isCompactGrid ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none border-l text-xs h-9 px-3"
                    onClick={() => setIsCompactGrid(false)}
                    title="Large grid"
                  >
                    Large
                  </Button>
                </div>
              </div>

              {/* Right Side - Pagination */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Page Navigation */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gold/40 bg-gold/10 text-gold text-xs sm:text-sm font-bold shadow-sm">
                  <span className="opacity-90">Page</span>
                  <Input
                    name="topPage"
                    type="number"
                    min={1}
                    max={Math.max(totalPages, 1)}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitPageInput();
                      }
                    }}
                    onBlur={commitPageInput}
                    className="h-7 w-14 text-center px-2 py-0 leading-none text-foreground bg-background/60 border border-gold/30 rounded"
                    title="Go to page"
                  />
                  <span className="opacity-70">/</span>
                  <span className="text-foreground text-sm leading-none px-1.5 py-0.5 rounded bg-background/60 border border-gold/30">
                    {Math.max(totalPages, 1)}
                  </span>
                </div>
              </div>
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
                      // Only allow valid listings: listed and owner matches lister
                      const listed = pass.expiration !== null && pass.best_price_hex !== null;
                      const owner = pass.token_owner?.toLowerCase?.();
                      const lister = pass.order_owner?.toLowerCase?.();
                      const valid = listed && owner && lister && owner === lister;
                      if (valid) togglePass(pass);
                    }}
                    pageId={`$collection${collection}`}
                  />
                )}

                {!tokensQuery.isLoading && tokens.length === 0 && Object.keys(selectedFilters).length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">No items match the selected filters.</div>
                )}
                {!tokensQuery.isLoading &&
                  tokens.length === 0 &&
                  Object.keys(selectedFilters).length === 0 &&
                  (totalItems > 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No items on this page. Try a lower page number or{" "}
                      <button className="underline" onClick={() => handlePageChange(Math.max(1, totalPages))}>
                        go to last page
                      </button>
                      .
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">No items available.</div>
                  ))}
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
              <div className="flex items-center justify-center gap-2 py-2 text-sm">
                <span>
                  Page <span className="font-semibold">{currentPage}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </span>
                <span className="text-muted-foreground">|</span>
                <span>Go to:</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget as HTMLFormElement;
                    const input = form.querySelector('input[name="page"]') as HTMLInputElement | null;
                    if (!input) return;
                    const raw = parseInt(input.value, 10);
                    if (!Number.isFinite(raw)) return;
                    const page = Math.min(Math.max(raw, 1), totalPages);
                    handlePageChange(page);
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    name="page"
                    type="number"
                    min={1}
                    max={totalPages}
                    defaultValue={currentPage}
                    className="h-8 w-16"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // let onSubmit handle it
                      }
                    }}
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Go
                  </Button>
                </form>
              </div>
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
