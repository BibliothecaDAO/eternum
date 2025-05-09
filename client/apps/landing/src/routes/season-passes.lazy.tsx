import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
import { SeasonPassesGrid } from "@/components/modules/season-passes-grid";
import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import TransferSeasonPassDialog from "@/components/modules/transfer-season-pass-dialog";
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
import { seasonPassAddress } from "@/config";
import { fetchTokenBalancesWithMetadata } from "@/hooks/services";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { displayAddress, trimAddress } from "@/lib/utils";

import { MergedNftData } from "@/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Grid2X2, Grid3X3 } from "lucide-react";
import { Suspense, useCallback, useState } from "react";

export const Route = createLazyFileRoute("/season-passes")({
  component: SeasonPasses,
});

type ViewMode = "my" | "all";

function SeasonPasses() {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [initialSelectedTokenId, setInitialSelectedTokenId] = useState<string | null>(null);
  const [controllerAddress] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("my");

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [seasonPassTokenBalanceQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["seasonPassTokenBalance", address],
        queryFn: () =>
          address
            ? fetchTokenBalancesWithMetadata(
                seasonPassAddress,
                trimAddress(address) /*, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE*/,
              )
            : null,
      },
      /*{
        queryKey: ["marketplaceOrders", marketplaceAddress],
        queryFn: () => execute(GET_MARKETPLACE_ORDERS, { limit: 8000 }),
        refetchInterval: 15_000,
      },*/
    ],
  });

  const getSeasonPassMetadataString = useCallback((pass: MergedNftData): string | null => {
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
  } = useTraitFiltering<MergedNftData>(seasonPassTokenBalanceQuery.data, getSeasonPassMetadataString);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredSeasonPasses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPasses = filteredSeasonPasses.slice(startIndex, endIndex);
  const [isCompactGrid, setIsCompactGrid] = useState(true);

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

  const totalPasses = seasonPassTokenBalanceQuery.data?.length;

  return (
    <div className="flex flex-col h-full">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">
            {viewMode === "my" ? "Your Season Passes" : "All Season Passes"}
          </h2>
          <p className="text-center text-muted-foreground mb-6">
            {viewMode === "my" ? "View and manage your Season Pass NFTs" : "Browse all available Season Pass NFTs."}
          </p>

          {/* Filter UI */}
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

          {/* Grid container - Removed extra bottom padding */}
          <div className="flex-grow overflow-y-auto pt-0 px-2 pb-4">
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton>Loading</Skeleton>}>
                {filteredSeasonPasses.length > 0 && (
                  <SeasonPassesGrid
                    checkOwner={true}
                    seasonPasses={paginatedPasses}
                    setIsTransferOpen={handleTransferClick}
                    isCompactGrid={isCompactGrid}
                  />
                )}

                {filteredSeasonPasses.length === 0 && Object.keys(selectedFilters).length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    No Season Passes match the selected filters.
                  </div>
                )}
                {totalPasses === 0 && (
                  <div className="text-center py-6 text-muted-foreground">You do not own any Season Pass NFTs yet.</div>
                )}
              </Suspense>
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

          {isTransferOpen && (
            <TransferSeasonPassDialog
              isOpen={isTransferOpen}
              setIsOpen={handleDialogClose}
              seasonPassMints={seasonPassTokenBalanceQuery.data}
              //seasonPassMints={mySeasonPassNfts as SeasonPassMint[]}
              initialSelectedTokenId={initialSelectedTokenId}
            />
          )}
        </>
      </>
    </div>
  );
}
