import { RealmMintDialog } from "@/components/modules/realm-mint-dialog";
import { RealmsGrid } from "@/components/modules/realms-grid";
import SeasonPassMintDialog from "@/components/modules/season-pass-mint-dialog";
import { SelectNftActions } from "@/components/modules/select-nft-actions";
import { TypeH3 } from "@/components/typography/type-h3";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { realmsAddress, seasonPassAddress } from "@/config";
import useNftSelection from "@/hooks/use-nft-selection";
import { displayAddress, trimAddress } from "@/lib/utils";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";

import { TraitFilterUI } from "@/components/modules/trait-filter-ui";
import { useTraitFiltering } from "@/hooks/useTraitFiltering";
import { Bug, Loader2, PartyPopper, Send } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
import { fetchSeasonPassRealmsByAddress, SeasonPassRealm } from "@/hooks/services";

export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

// Define the structure of the augmented realm used internally
export interface AugmentedRealm {
  originalRealm: SeasonPassRealm; // Keep the original structure
  parsedMetadata: {
    name: string;
    attributes: { trait_type: string; value: string }[];
    image: string;
    description?: string;
  };
  seasonPassMinted: boolean;
  tokenId: string;
}

function Mint() {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const trimmedAddress = trimAddress(address);

  const [isOpen, setIsOpen] = useState(false);
  const [isRealmMintOpen, setIsRealmMintIsOpen] = useState(false);
  const [controllerAddress] = useState<string>();

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  // --- Fetch data ---
  const [seasonPassMints] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["seasonPassMints", trimmedAddress],
        queryFn: () =>
          trimmedAddress ? fetchSeasonPassRealmsByAddress(realmsAddress, seasonPassAddress, trimmedAddress) : null,
        refetchInterval: 10_000,
      },
    ],
  });

  // --- Prepare Realm Data ---
  const realmsErcBalance = seasonPassMints.data;

  // --- Filtering Hook ---
  const getRealmMetadataString = useCallback((realm: SeasonPassRealm) => {
    if (!realm.metadata) return null;
    return realm.metadata;
  }, []);

  const {
    selectedFilters,
    allTraits,
    filteredData: filteredRealms,
    handleFilterChange: originalHandleFilterChange,
    clearFilter: originalClearFilter,
    clearAllFilters: originalClearAllFilters,
  } = useTraitFiltering<SeasonPassRealm>(realmsErcBalance, getRealmMetadataString);

  // --- State for Season Pass Mint Status ---
  const [seasonPassStatus, setSeasonPassStatus] = useState<Record<string, boolean>>({});

  const handleSeasonPassStatusChange = useCallback((tokenId: string, hasMinted: boolean) => {
    setSeasonPassStatus((prev) => ({ ...prev, [tokenId]: hasMinted }));
  }, []);

  // --- Augment, Sort Filtered Data ---
  const augmentedAndSortedRealms = useMemo(() => {
    // 1. Augment the *filtered* data with parsed metadata and mint status
    const augmented = filteredRealms
      .map((realm) => {
        const tokenId = parseInt(realm?.token_id);

        let parsedMetadata: { name: string; attributes: { trait_type: string; value: string | number }[] } = {
          name: "",
          attributes: [],
        };
        try {
          const metadata = getRealmMetadataString(realm);
          if (metadata) {
            parsedMetadata = metadata;
          }
        } catch (e) {
          console.error(`Failed to parse metadata for token ${tokenId}:`, e);
        }

        return {
          originalRealm: realm,
          parsedMetadata: parsedMetadata,
          seasonPassMinted: realm.season_pass_balance !== null,
          tokenId: tokenId.toString(),
        } as AugmentedRealm;
      })
      .filter((realm): realm is AugmentedRealm => realm !== null);

    // 2. Sort the augmented array - Can probably move to sql ordering
    return augmented.sort((a, b) => {
      // Sort by minted status first (false/unminted comes first)
      if (a.seasonPassMinted !== b.seasonPassMinted) {
        return a.seasonPassMinted ? 1 : -1;
      }
      // Then sort by name
      const aName = a.parsedMetadata?.name || "";
      const bName = b.parsedMetadata?.name || "";
      return aName.localeCompare(bName);
    });
  }, [filteredRealms, seasonPassStatus, getRealmMetadataString]);

  // --- NFT Selection Hook ---
  const { deselectAllNfts, isNftSelected, selectBatchNfts, toggleNftSelection, totalSelectedNfts, selectedTokenIds } =
    useNftSelection({ userAddress: address as `0x${string}` });

  const loading = seasonPassMints.isLoading;

  const selectBatchNftsFiltered = (contractAddress: string, tokenIds: string[]) => {
    // Filter based on the currently displayed (and potentially filtered) *augmented* list
    const eligibleDisplayedTokenIds = augmentedAndSortedRealms.filter((r) => !r.seasonPassMinted).map((r) => r.tokenId);

    const idsToSelect = tokenIds.filter((id) => eligibleDisplayedTokenIds.includes(id));
    selectBatchNfts(contractAddress ?? "", idsToSelect);
  };

  // --- Calculate Minting Status (Based on original data) ---
  const totalRealms = useMemo(() => realmsErcBalance?.length ?? 0, [realmsErcBalance]);

  const mintedRealmsCount = useMemo(() => {
    return seasonPassMints.data?.filter((realm) => realm.season_pass_balance !== null).length ?? 0;
  }, [seasonPassMints.data]);

  const allMinted = totalRealms > 0 && mintedRealmsCount === totalRealms;

  const isDev = import.meta.env.VITE_PUBLIC_CHAIN !== "mainnet";

  // --- Pagination Logic ---
  const totalPages = Math.ceil(augmentedAndSortedRealms.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRealms = augmentedAndSortedRealms.slice(startIndex, endIndex);
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

  // --- Wallet Connection Check ---
  if (!trimmedAddress) {
    return <ConnectWalletPrompt connectors={connectors} connect={connect} />; // Pass connect here
  }
  // --- End Wallet Connection Check ---

  return (
    <div className="flex flex-col h-full">
      {loading && (
        <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      )}
      <>
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            {controllerAddress && (
              <div className="text-xl py-4 flex items-center">
                Minting to:{" "}
                <Badge variant="secondary" className="text-lg ml-4 py-1.5">
                  <img className="w-6 pr-2" src={connectors[2].icon as string} alt="Connector Icon" />
                  {displayAddress(controllerAddress)}
                </Badge>
              </div>
            )}
          </div>
          {isDev && (
            <Button
              onClick={() => setIsRealmMintIsOpen(true)}
              variant="destructive"
              className="flex items-center gap-2 rotate-[-6deg] hover:animate-pulse"
            >
              <Bug className="h-4 w-4" />
              Mint a Realm
            </Button>
          )}
        </div>

        {/* Page Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Mint Season Passes for your Realms</h2>
        <p className="text-center text-muted-foreground mb-6">
          Select your Realm NFTs below to mint their corresponding Season Pass NFTs.
        </p>

        {/* --- Use the Reusable Filter UI --- */}
        <TraitFilterUI
          allTraits={allTraits}
          selectedFilters={selectedFilters}
          handleFilterChange={handleFilterChange}
          clearFilter={clearFilter}
          clearAllFilters={clearAllFilters}
        />
        {/* --- End Filter UI --- */}

        <div className="flex-grow overflow-y-auto">
          <div className="flex flex-col gap-4 px-2 pb-4">
            {!allMinted && totalRealms > 0 && (
              <div className="m-2 flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-base text-blue-800 shadow-sm ">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-info h-5 w-5 text-blue-600 flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>Please note: It may take up to a minute for newly minted Season Passes to show up.</span>
              </div>
            )}
            <Suspense fallback={<Skeleton>Loading</Skeleton>}>
              {/* Show allMinted message only if no filters are active */}
              {allMinted && Object.keys(selectedFilters).length === 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-lime-300 bg-lime-50 p-4 text-lime-800 shadow-sm">
                  <PartyPopper className="h-6 w-6 text-lime-600" />
                  <span className="font-semibold">Congratulations! All your Realms have Season Passes minted.</span>
                </div>
              )}

              {/* Show message if filters result in no realms */}
              {augmentedAndSortedRealms.length === 0 && Object.keys(selectedFilters).length > 0 && !loading && (
                <div className="text-center py-6 text-muted-foreground">No realms match the selected filters.</div>
              )}

              {/* --- Top Action Bar (sm+) --- */}
              {/* Only show action bar if there are *filtered* and *augmented* realms eligible for minting */}
              {augmentedAndSortedRealms.some((realm) => !realm.seasonPassMinted) && totalSelectedNfts > 0 && (
                <div className="hidden sm:flex sticky top-0 z-20 bg-background justify-between items-center p-2  border-gold/15 border rounded-2xl">
                  <div className="flex items-center gap-4 w-auto">
                    {(() => {
                      // Calculate eligible based on *currently displayed* augmented realms
                      const eligibleTokenIds = augmentedAndSortedRealms
                        .filter((realm) => !realm.seasonPassMinted)
                        .map((realm) => realm.tokenId);

                      console.log("eligibleTokenIds", eligibleTokenIds);

                      const contractAddress = augmentedAndSortedRealms[0]?.originalRealm?.contract_address;

                      return (
                        <SelectNftActions
                          totalSelectedNfts={totalSelectedNfts}
                          // Pass only eligible IDs from the *currently displayed* set
                          selectBatchNfts={(contract, ids) => selectBatchNftsFiltered(contract, ids)}
                          deselectAllNfts={deselectAllNfts}
                          contractAddress={contractAddress}
                          eligibleTokenIds={eligibleTokenIds}
                          totalEligibleNfts={eligibleTokenIds.length}
                        />
                      );
                    })()}

                    <div className="whitespace-nowrap">
                      {" "}
                      {/* Selected Count */}
                      <TypeH3>{totalSelectedNfts} Selected</TypeH3>
                    </div>
                  </div>

                  <Button
                    disabled={totalSelectedNfts < 1}
                    onClick={() => setIsOpen(true)}
                    variant="cta"
                    className="w-auto sm:px-8 sm:py-2.5 flex items-center gap-2 transition-all duration-200
                                font-sans hover:shadow-[0_0_15px_3px_rgba(234,179,8,0.5)] focus:shadow-[0_0_15px_3px_rgba(234,179,8,0.5)]"
                  >
                    <Send className="!h-4 !w-4" />
                    Claim {totalSelectedNfts > 0 ? `${totalSelectedNfts} ` : ""}Season Pass
                    {totalSelectedNfts > 1 ? "es" : ""}
                  </Button>
                </div>
              )}
              {/* --- End Top Action Bar --- */}

              {/* Use augmentedAndSortedRealms for the grid */}
              <RealmsGrid
                isNftSelected={isNftSelected}
                toggleNftSelection={toggleNftSelection}
                realms={paginatedRealms ?? []} // Use paginated data
                onSeasonPassStatusChange={handleSeasonPassStatusChange}
              />
            </Suspense>
          </div>
        </div>

        {/* Sticky Bottom Action Bar (Mobile Only) */}
        {/* Only show action bar if there are *filtered* and *augmented* realms eligible for minting */}
        {augmentedAndSortedRealms.some((realm) => !realm.seasonPassMinted) && totalSelectedNfts > 0 && (
          <div className="sm:hidden sticky bottom-0 z-20 bg-background border-t border-gold/15 p-4 mt-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              {/* Selection actions - Updated to use augmented/sorted/filtered realms */}
              {(() => {
                // Calculate eligible based on *currently displayed* augmented realms
                const eligibleTokenIds = augmentedAndSortedRealms
                  .filter((realm) => !realm.seasonPassMinted)
                  .map((realm) => realm.tokenId);

                // Safely access contractAddress only for ERC721 from the first displayed realm's original data
                const contractAddress = augmentedAndSortedRealms[0]?.originalRealm?.contract_address;

                return (
                  <SelectNftActions
                    totalSelectedNfts={totalSelectedNfts}
                    // Pass only eligible IDs from the *currently displayed* set
                    selectBatchNfts={(contract, ids) => selectBatchNftsFiltered(contract, ids)}
                    deselectAllNfts={deselectAllNfts}
                    contractAddress={contractAddress}
                    eligibleTokenIds={eligibleTokenIds}
                    totalEligibleNfts={eligibleTokenIds.length}
                  />
                );
              })()}
              <div className="whitespace-nowrap ml-auto sm:ml-0">
                {" "}
                {/* Selected count */}
                <TypeH3>{totalSelectedNfts} Selected</TypeH3>
              </div>
            </div>
            <Button
              disabled={totalSelectedNfts < 1}
              onClick={() => setIsOpen(true)}
              variant="cta"
              className="w-full sm:w-auto sm:px-8 sm:py-2.5 flex items-center gap-2 transition-all duration-200
                             hover:shadow-[0_0_15px_3px_rgba(234,179,8,0.5)] focus:shadow-[0_0_15px_3px_rgba(234,179,8,0.5)]" /* Mint Button */
            >
              <Send className="!h-4 !w-4" />
              Mint {totalSelectedNfts > 1 ? `${totalSelectedNfts} ` : ""}Season Pass
              {totalSelectedNfts > 1 ? "es" : ""}
            </Button>
          </div>
        )}

        {/* --- Pagination Controls --- */}
        {totalPages > 1 && (
          <Pagination className="py-4 border-t">
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
              {/* Render dynamic pagination items */}
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
        )}
        {/* --- End Pagination Controls --- */}

        {isOpen && (
          <SeasonPassMintDialog
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            deselectAllNfts={deselectAllNfts}
            isSuccess={false} // Pass default value for isSuccess
            realm_ids={selectedTokenIds} // Pass only selected IDs
          />
        )}
        {isRealmMintOpen && (
          <RealmMintDialog
            totalOwnedRealms={totalRealms} // Use total count before filtering
            isOpen={isRealmMintOpen}
            setIsOpen={setIsRealmMintIsOpen}
          />
        )}
      </>
    </div>
  );
}
