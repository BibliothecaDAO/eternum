import { RealmMintDialog } from "@/components/modules/realm-mint-dialog";
import { RealmsGrid } from "@/components/modules/realms-grid";
import SeasonPassMintDialog from "@/components/modules/season-pass-mint-dialog";
import { SelectNftActions } from "@/components/modules/select-nft-actions";
import { TypeH3 } from "@/components/typography/type-h3";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { realmsAddress } from "@/config";
import { execute } from "@/hooks/gql/execute";
import { GET_ACCOUNT_TOKENS } from "@/hooks/query/erc721";
import useNftSelection from "@/hooks/use-nft-selection";
import { displayAddress } from "@/lib/utils";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";

import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
import { Bug, Loader2, PartyPopper, Send } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const [isOpen, setIsOpen] = useState(false);
  const [isRealmMintOpen, setIsRealmMintIsOpen] = useState(false);

  const [controllerAddress] = useState<string>();

  const { data, isLoading: isPending } = useSuspenseQuery({
    queryKey: ["erc721Balance", address],
    queryFn: () => (address ? execute(GET_ACCOUNT_TOKENS, { accountAddress: address }) : null),
    refetchInterval: 10_000,
  });

  const realmsErcBalance = useMemo(
    () =>
      data?.tokenBalances?.edges?.filter((token) => {
        if (token?.node?.tokenMetadata.__typename !== "ERC721__Token") return false;
        return (
          addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
          addAddressPadding(realmsAddress ?? "0x0")
        );
      }),
    [data, realmsAddress],
  );

  const isDev = import.meta.env.VITE_PUBLIC_CHAIN !== "mainnet";

  const { deselectAllNfts, isNftSelected, selectBatchNfts, toggleNftSelection, totalSelectedNfts, selectedTokenIds } =
    useNftSelection({ userAddress: address as `0x${string}` });

  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  const loading = isPending; /*|| isSeasonPassMintsLoading*/

  const [seasonPassStatus, setSeasonPassStatus] = useState<Record<string, boolean>>({});

  const handleSeasonPassStatusChange = useCallback((tokenId: string, hasMinted: boolean) => {
    setSeasonPassStatus((prev) => ({ ...prev, [tokenId]: hasMinted }));
  }, []);

  const selectBatchNftsFiltered = (contractAddress: string, tokenIds: string[]) => {
    const filteredTokenIds = tokenIds.filter((id) => !seasonPassStatus[id]);
    selectBatchNfts(contractAddress ?? "", filteredTokenIds);
  };

  const sortedRealms = useMemo(() => {
    // Filter out null/undefined realms first
    const validRealms = realmsErcBalance?.filter((realm) => !!realm?.node) || [];

    // Augment realms with their mint status
    const augmentedRealms = validRealms
      .map((realm) => {
        // Ensure realm and node exist before proceeding
        if (!realm?.node) return null; // Return null for invalid entries

        // Extract tokenId safely
        const tokenId = realm.node.tokenMetadata.__typename === "ERC721__Token" ? realm.node.tokenMetadata.tokenId : "";

        return {
          ...realm,
          seasonPassMinted: seasonPassStatus[tokenId] ?? false, // Get status from state, default to false
        };
      })
      .filter(Boolean); // Filter out any nulls introduced by the check above

    // Sort the augmented array
    return augmentedRealms.sort((a, b) => {
      // Add null checks for TypeScript, even though filter(Boolean) removed them
      if (!a) return 1;
      if (!b) return -1;

      // Sort by minted status first (false/unminted comes first)
      if (a.seasonPassMinted !== b.seasonPassMinted) {
        return a.seasonPassMinted ? 1 : -1;
      }

      try {
        const aName =
          a.node?.tokenMetadata.__typename === "ERC721__Token"
            ? JSON.parse(a.node.tokenMetadata.metadata || "{}").name || ""
            : "";
        const bName =
          b.node?.tokenMetadata.__typename === "ERC721__Token"
            ? JSON.parse(b.node.tokenMetadata.metadata || "{}").name || ""
            : "";
        return aName.localeCompare(bName);
      } catch {
        return 0;
      }
    });
  }, [realmsErcBalance, seasonPassStatus]);

  // Calculate minting status
  const totalRealms = sortedRealms.length;
  const mintedRealmsCount = sortedRealms.filter((realm) => realm && realm.seasonPassMinted).length;
  const allMinted = totalRealms > 0 && mintedRealmsCount === totalRealms;
  console.log(sortedRealms, totalRealms, mintedRealmsCount);

  // If wallet is not connected, show a prominent connect message
  if (!address) {
    return <ConnectWalletPrompt connectors={connectors} connect={connect} />;
  }

  // Render the minting interface if wallet is connected
  return (
    <div className="flex flex-col h-full p-4">
      {loading && (
        <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      )}
      <>
        <div className="flex justify-between items-center mb-4">
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

        <div className="flex-grow overflow-y-auto">
          <div className="flex flex-col gap-4">
            {!allMinted && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-base text-blue-800 shadow-sm">
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
              {allMinted && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-lime-300 bg-lime-50 p-4 text-lime-800 shadow-sm">
                  <PartyPopper className="h-6 w-6 text-lime-600" />
                  <span className="font-semibold">Congratulations! All your Realms have Season Passes minted.</span>
                </div>
              )}

              {/* --- Top Action Bar (sm+) --- */}
              {totalRealms > 0 && !allMinted && totalSelectedNfts > 0 && (
                <div className="hidden sm:flex sticky top-0 z-20 bg-background justify-between items-center p-2  border-gold/15 border rounded-2xl">
                  <div className="flex items-center gap-4 w-auto">
                    {" "}
                    {/* Selection controls part */}
                    {(data?.tokenBalances?.edges?.length ?? 0) > 0 &&
                      (() => {
                        const allTokenIds =
                          realmsErcBalance
                            ?.map((token) =>
                              token?.node?.tokenMetadata.__typename === "ERC721__Token"
                                ? token.node.tokenMetadata.tokenId
                                : "",
                            )
                            .filter((tokenId): tokenId is string => tokenId !== "") ?? [];

                        const eligibleTokenIds = allTokenIds.filter((id) => !seasonPassStatus[id]);

                        return (
                          <SelectNftActions
                            totalSelectedNfts={totalSelectedNfts}
                            selectBatchNfts={selectBatchNftsFiltered}
                            deselectAllNfts={deselectAllNfts}
                            contractAddress={
                              realmsErcBalance?.[0]?.node?.tokenMetadata.__typename === "ERC721__Token"
                                ? realmsErcBalance[0].node.tokenMetadata.contractAddress
                                : ""
                            }
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

              <RealmsGrid
                isNftSelected={isNftSelected}
                toggleNftSelection={toggleNftSelection}
                realms={sortedRealms ?? []}
                onSeasonPassStatusChange={handleSeasonPassStatusChange}
              />
            </Suspense>
          </div>
        </div>

        {/* Sticky Bottom Action Bar (Mobile Only) */}
        {totalRealms > 0 &&
          !allMinted &&
          totalSelectedNfts > 0 && ( // Only show actions if there are realms, not all are minted, AND at least one is selected
            <div className="sm:hidden sticky bottom-0 z-20 bg-background border-t border-gold/15 p-4 mt-auto">
              {" "}
              {/* MODIFIED: Added sm:hidden */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {" "}
                {/* Inner container */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {" "}
                  {/* Selection actions */}
                  {(data?.tokenBalances?.edges?.length ?? 0) > 0 &&
                    (() => {
                      // Ensure edges exist before calculating
                      const allTokenIds =
                        realmsErcBalance
                          ?.map((token) =>
                            token?.node?.tokenMetadata.__typename === "ERC721__Token"
                              ? token.node.tokenMetadata.tokenId
                              : "",
                          )
                          .filter((tokenId): tokenId is string => tokenId !== "") ?? [];

                      const eligibleTokenIds = allTokenIds.filter((id) => !seasonPassStatus[id]);

                      return (
                        <SelectNftActions
                          totalSelectedNfts={totalSelectedNfts}
                          selectBatchNfts={selectBatchNftsFiltered} // Uses filtered list internally
                          deselectAllNfts={deselectAllNfts}
                          contractAddress={
                            realmsErcBalance?.[0]?.node?.tokenMetadata.__typename === "ERC721__Token"
                              ? realmsErcBalance[0].node.tokenMetadata.contractAddress
                              : ""
                          }
                          eligibleTokenIds={eligibleTokenIds} // Pass the filtered list
                          totalEligibleNfts={eligibleTokenIds.length} // Pass the count for comparison
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
            </div>
          )}

        {isOpen && (
          <SeasonPassMintDialog
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            deselectAllNfts={deselectAllNfts}
            isSuccess={status === "success"}
            realm_ids={selectedTokenIds}
          />
        )}
        {isRealmMintOpen && (
          <RealmMintDialog
            totalOwnedRealms={realmsErcBalance?.length}
            isOpen={isRealmMintOpen}
            setIsOpen={setIsRealmMintIsOpen}
          />
        )}
      </>
    </div>
  );
}
