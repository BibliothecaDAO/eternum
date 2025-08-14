import { ChestOpeningModal } from "@/components/modules/chest-opening-modal";
import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
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
import { useLootChestOpeningStore } from "@/stores/loot-chest-opening";
import { useSelectedPassesStore } from "@/stores/selected-passes";

import { MergedNftData } from "@/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { useQuery, useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Grid2X2, Grid3X3 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/$collection")({
  component: ManageCollectionRoute,
});

function ManageCollectionRoute() {
  const { collection } = Route.useParams();
  const collectionAddress = marketplaceCollections[collection as keyof typeof marketplaceCollections].address;
  const collectionName = marketplaceCollections[collection as keyof typeof marketplaceCollections].name;
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [initialSelectedTokenId, setInitialSelectedTokenId] = useState<string | null>(null);
  const [controllerAddress] = useState<string>();
  const marketplaceActions = useMarketplace();
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const { showLootChestOpening, openedChestTokenId } = useLootChestOpeningStore();

  const [tokenBalanceQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["tokenBalance", collection, address],
        queryFn: () => (address ? fetchTokenBalancesWithMetadata(collectionAddress, address) : null),
        refetchInterval: 8_000,
      },
    ],
  });

  const { data: collectionStats } = useQuery({
    queryKey: ["collectionStatistics", collectionAddress],
    queryFn: () => fetchCollectionStatistics(collectionAddress),
    refetchInterval: 60_000,
  });

  const getMetadataString = useCallback((token: MergedNftData) => {
    if (token?.metadata) {
      return token.metadata;
    }
    return null;
  }, []);

  const tokensWithFloorPrice = useMemo(() => {
    if (!tokenBalanceQuery.data || !collectionStats?.[0]?.floor_price_wei) return tokenBalanceQuery.data;

    const floorPrice = formatUnits(BigInt(collectionStats?.[0]?.floor_price_wei), 18);
    return tokenBalanceQuery.data.map((token) => ({
      ...token,
      collection_floor_price: floorPrice,
    }));
  }, [tokenBalanceQuery.data, collectionStats]);

  const [nextChestToken, setNextChestToken] = useState<string | null>(null);
  const [remainingChests, setRemainingChests] = useState<number>(0);

  useEffect(() => {
    if (!tokensWithFloorPrice || !openedChestTokenId) return;
    const remainingTokens = tokensWithFloorPrice.filter(
      (token) => token.token_id !== openedChestTokenId && token.token_id !== "42",
    );
    setNextChestToken(remainingTokens.length > 0 ? remainingTokens[0].token_id.toString() : null);
    setRemainingChests(remainingTokens.length);
  }, [tokensWithFloorPrice, openedChestTokenId]);

  const {
    selectedFilters,
    allTraits,
    filteredData: filteredTokens,
    handleFilterChange: originalHandleFilterChange,
    clearFilter: originalClearFilter,
    clearAllFilters: originalClearAllFilters,
  } = useTraitFiltering<MergedNftData>(tokensWithFloorPrice, getMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredTokens.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTokens = filteredTokens.slice(startIndex, endIndex);
  const [isCompactGrid, setIsCompactGrid] = useState(true);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);

  const { selectedPasses, togglePass, clearSelection, getTotalPrice } = useSelectedPassesStore(
    `collection-${collection}`,
  );

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

  // Only allow transfer for user's own tokens
  const handleTransferClick = useCallback((tokenId?: string) => {
    setInitialSelectedTokenId(tokenId || null);
    setIsTransferOpen(true);
  }, []);

  // Create a handler to reset the initial token ID when dialog closes
  const handleDialogClose = (open: boolean) => {
    setIsTransferOpen(open);
    if (!open) {
      setInitialSelectedTokenId(null);
    }
  };

  if (!address) {
    return <ConnectWalletPrompt connectors={connectors} connect={connect} />;
  }

  const totalTokens = tokenBalanceQuery.data?.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
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

        {/* Page Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">Your {collectionName}</h2>
        <p className="text-center text-muted-foreground mb-6">View and manage your {collectionName} NFTs</p>

        {/* Filter UI */}
        <ScrollHeader className="flex flex-row justify-between items-center" onScrollChange={setIsHeaderScrolled}>
          {isHeaderScrolled ? (
            <h4 className="text-lg sm:text-xl font-bold mb-2 pl-4">Your {collectionName}</h4>
          ) : (
            <div></div>
          )}

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

        {/* Grid container - Removed extra bottom padding */}
        <div className="flex-grow pt-0 px-2 pb-4">
          <div className="flex flex-col gap-2">
            <Suspense fallback={<Skeleton>Loading</Skeleton>}>
              {filteredTokens.length > 0 && (
                <CollectionTokenGrid
                  tokens={paginatedTokens}
                  setIsTransferOpen={handleTransferClick}
                  isCompactGrid={isCompactGrid}
                  onToggleSelection={togglePass}
                  pageId={`collection-${collection}`}
                />
              )}

              {filteredTokens.length === 0 && Object.keys(selectedFilters).length > 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  No {collectionName} match the selected filters.
                </div>
              )}
              {totalTokens === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  You do not own any {collectionName} NFTs yet.
                </div>
              )}
            </Suspense>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 left-0 right-0 bg-background border-t py-2 px-4 shadow-lg">
          <div className="container mx-auto flex gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedPasses.length > 0 /*&& sweepCount === 0 && !debouncedSweepCount*/ && (
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
          <Pagination className=" pb-4 border-t border-gold/15">
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

        {isTransferOpen && tokenBalanceQuery.data && (
          <TransferNftDialog
            isOpen={isTransferOpen}
            setIsOpen={handleDialogClose}
            nfts={tokenBalanceQuery.data}
            collectionName={collectionName}
            collectionAddress={collectionAddress}
            initialSelectedTokenId={initialSelectedTokenId}
          />
        )}
        {showLootChestOpening && <ChestOpeningModal remainingChests={remainingChests} nextToken={nextChestToken} />}
      </>
    </div>
  );
}
