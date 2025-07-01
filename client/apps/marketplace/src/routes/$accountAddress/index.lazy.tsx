import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import { CreateListingsDrawer } from "@/components/modules/marketplace-create-listings-drawer";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import TransferNftDialog from "@/components/modules/transfer-nft-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { marketplaceCollections } from "@/config";
import { fetchCollectionStatistics, fetchTokenBalancesWithMetadata } from "@/hooks/services";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress } from "@/lib/utils";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { MergedNftData } from "@/types";
import { useQueries } from "@tanstack/react-query";
import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { Grid2X2, Grid3X3 } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";

export const Route = createLazyFileRoute("/$accountAddress/")({
  component: AccountProfilePage,
  pendingComponent: FullPageLoader,
});

export default function AccountProfilePage() {
  const { accountAddress } = useParams({ strict: false }) as { accountAddress: string };

  // --- State Management ---
  const [currentPage, setCurrentPage] = useState(1);
  const [isCompactGrid, setIsCompactGrid] = useState(true);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [initialSelectedTokenId, setInitialSelectedTokenId] = useState<string | null>(null);
  const [selectedCollectionForTransfer, setSelectedCollectionForTransfer] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 24;

  const marketplaceActions = useMarketplace();

  // Prepare queries for each collection
  const collectionEntries = Object.entries(marketplaceCollections);
  const queries = useQueries({
    queries: collectionEntries.map(([, collection]) => ({
      queryKey: ["ownedTokens", collection.address, accountAddress],
      queryFn: () => fetchTokenBalancesWithMetadata(collection.address, accountAddress),
      enabled: !!accountAddress,
    })),
  });

  // Fetch collection statistics for floor prices
  const collectionStatsQueries = useQueries({
    queries: collectionEntries.map(([, collection]) => ({
      queryKey: ["collectionStatistics", collection.address],
      queryFn: () => fetchCollectionStatistics(collection.address),
      refetchInterval: 60_000,
    })),
  });

  // Combine all tokens with floor prices
  const allTokensWithFloorPrice = useMemo(() => {
    const allTokens: MergedNftData[] = [];

    queries.forEach((query, idx) => {
      if (query.data && collectionStatsQueries[idx].data?.[0]?.floor_price_wei) {
        const floorPrice = BigInt(collectionStatsQueries[idx].data[0].floor_price_wei);
        const tokensWithFloor = query.data.map((token) => ({
          ...token,
          collection_floor_price: floorPrice,
        }));
        allTokens.push(...tokensWithFloor);
      } else if (query.data) {
        allTokens.push(...query.data);
      }
    });

    return allTokens;
  }, [queries, collectionStatsQueries]);

  const getMetadataString = useCallback((token: MergedNftData) => {
    if (token?.metadata) {
      return token.metadata;
    }
    return null;
  }, []);

  const {
    selectedFilters,
    allTraits,
    filteredData: filteredTokens,
    handleFilterChange: originalHandleFilterChange,
    clearFilter: originalClearFilter,
    clearAllFilters: originalClearAllFilters,
  } = useTraitFiltering<MergedNftData>(allTokensWithFloorPrice, getMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredTokens.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTokens = filteredTokens.slice(startIndex, endIndex);

  const { selectedPasses, togglePass, clearSelection } = useSelectedPassesStore(`profile-${accountAddress}`);

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

  // Transfer functionality
  const handleTransferClick = useCallback(
    (tokenId?: string) => {
      if (tokenId) {
        // Find the collection for this token
        const token = allTokensWithFloorPrice.find((t) => t.token_id.toString() === tokenId);
        if (token) {
          setSelectedCollectionForTransfer(token.contract_address);
        }
      }
      setInitialSelectedTokenId(tokenId || null);
      setIsTransferOpen(true);
    },
    [allTokensWithFloorPrice],
  );

  // Create a handler to reset the initial token ID when dialog closes
  const handleDialogClose = (open: boolean) => {
    setIsTransferOpen(open);
    if (!open) {
      setInitialSelectedTokenId(null);
      setSelectedCollectionForTransfer(null);
    }
  };

  // Check if any queries are loading
  const isLoading = queries.some((query) => query.isLoading);
  const hasError = queries.some((query) => query.error);
  const totalTokens = allTokensWithFloorPrice.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">Account Profile</h1>
      <p className="text-center text-muted-foreground mb-6">View and manage your NFT collections</p>

      {/* Account Address */}
      <div className="text-center mb-6">
        <div className="text-lg font-mono text-muted-foreground break-all">{displayAddress(accountAddress)}</div>
      </div>

      {/* Filter UI */}
      <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
        {isHeaderScrolled ? <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">Account Profile</h4> : <div></div>}

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

      {/* Grid container */}
      <div className="flex-grow pt-0 px-2 pb-4">
        <div className="flex flex-col gap-2">
          <Suspense fallback={<Skeleton>Loading</Skeleton>}>
            {isLoading && <div className="text-center py-6 text-muted-foreground">Loading your NFTs...</div>}

            {hasError && <div className="text-center py-6 text-destructive">Error loading tokens.</div>}

            {!isLoading && !hasError && filteredTokens.length > 0 && (
              <CollectionTokenGrid
                tokens={paginatedTokens}
                setIsTransferOpen={handleTransferClick}
                isCompactGrid={isCompactGrid}
                onToggleSelection={togglePass}
                pageId={`profile-${accountAddress}`}
              />
            )}

            {!isLoading && !hasError && filteredTokens.length === 0 && Object.keys(selectedFilters).length > 0 && (
              <div className="text-center py-6 text-muted-foreground">No NFTs match the selected filters.</div>
            )}

            {!isLoading && !hasError && totalTokens === 0 && (
              <div className="text-center py-6 text-muted-foreground">This account does not own any NFTs yet.</div>
            )}
          </Suspense>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 left-0 right-0 bg-background border-t py-2 px-4 shadow-lg">
        <div className="container mx-auto flex gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedPasses.length > 0 && (
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
                    <span className="text-sm font-medium text-muted-foreground">+{selectedPasses.length - 3} more</span>
                  )}
                </div>
              )}
              <CreateListingsDrawer
                tokens={selectedPasses}
                isLoading={false}
                isSyncing={false}
                marketplaceActions={marketplaceActions}
              />
              {selectedPasses.length > 0 && (
                <Button variant={"ghost"} onClick={() => clearSelection()}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination className="pb-4 border-t border-gold/15">
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

      {/* Transfer Dialog */}
      {isTransferOpen && selectedCollectionForTransfer && (
        <TransferNftDialog
          isOpen={isTransferOpen}
          setIsOpen={handleDialogClose}
          nfts={allTokensWithFloorPrice.filter((token) => token.contract_address === selectedCollectionForTransfer)}
          initialSelectedTokenId={initialSelectedTokenId}
          contractAddress={selectedCollectionForTransfer}
          contractAbi={[]} // This would need to be the actual ABI for the collection
        />
      )}
    </div>
  );
}
