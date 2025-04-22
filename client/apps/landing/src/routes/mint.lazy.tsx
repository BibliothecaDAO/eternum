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

import { Loader2 } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const { connectors } = useConnect();
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

  const loading = isPending; /*|| isSeasonPassMintsLoading*/

  const [seasonPassStatus, setSeasonPassStatus] = useState<Record<string, boolean>>({});

  const handleSeasonPassStatusChange = (tokenId: string, hasMinted: boolean) => {
    setSeasonPassStatus((prev) => ({ ...prev, [tokenId]: hasMinted }));
  };

  const selectBatchNftsFiltered = (contractAddress: string, tokenIds: string[]) => {
    const filteredTokenIds = tokenIds.filter((id) => !seasonPassStatus[id]);
    selectBatchNfts(contractAddress ?? "", filteredTokenIds);
  };

  return (
    <div className="flex flex-col h-full">
      {loading && (
        <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      )}
      <>
        {controllerAddress && (
          <div className="text-xl py-4 flex items-center">
            Minting to:{" "}
            <Badge variant="secondary" className="text-lg ml-4 py-1.5">
              <img className="w-6 pr-2" src={connectors[2].icon as string} alt="Connector Icon" />
              {displayAddress(controllerAddress)}
            </Badge>
          </div>
        )}

        <>
          <div className="flex-grow overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton>Loading</Skeleton>}>
                <RealmsGrid
                  isNftSelected={isNftSelected}
                  toggleNftSelection={toggleNftSelection}
                  realms={realmsErcBalance ?? []}
                  onSeasonPassStatusChange={handleSeasonPassStatusChange}
                />
              </Suspense>
            </div>
          </div>
          <div className="flex justify-between border-t border-gold/15 p-4 sticky bottom-0 gap-8">
            {isDev ? (
              <Button onClick={() => setIsRealmMintIsOpen(true)} variant="cta">
                Mint Realms
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-8">
              {data?.tokenBalances?.edges && (
                <SelectNftActions
                  totalSelectedNfts={totalSelectedNfts}
                  selectBatchNfts={selectBatchNftsFiltered}
                  deselectAllNfts={deselectAllNfts}
                  contractAddress={
                    realmsErcBalance?.[0]?.node?.tokenMetadata.__typename === "ERC721__Token"
                      ? realmsErcBalance[0].node.tokenMetadata.contractAddress
                      : ""
                  }
                  batchTokenIds={realmsErcBalance
                    ?.map((token) =>
                      token?.node?.tokenMetadata.__typename === "ERC721__Token" ? token.node.tokenMetadata.tokenId : "",
                    )
                    .filter((tokenId): tokenId is string => tokenId !== "")}
                />
              )}
              <TypeH3>{totalSelectedNfts} Selected</TypeH3>

              <Button disabled={totalSelectedNfts < 1} onClick={() => setIsOpen(true)} variant="cta">
                Mint Season Passes
              </Button>
            </div>
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
          </div>
        </>
      </>
    </div>
  );
}
