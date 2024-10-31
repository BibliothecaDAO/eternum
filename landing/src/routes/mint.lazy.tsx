import { AttributeFilters } from "@/components/modules/filters";
import { RealmMintDialog } from "@/components/modules/realm-mint-dialog";
import { RealmsGrid } from "@/components/modules/realms-grid";
import SeasonPassMintDialog from "@/components/modules/season-pass-mint-dialog";
import { SelectNftActions } from "@/components/modules/select-nft-actions";
import { TypeH2 } from "@/components/typography/type-h2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { execute } from "@/hooks/gql/execute";
import { GET_ERC_MINTS, GET_REALMS } from "@/hooks/query/realms";
import useAccountOrBurner from "@/hooks/useAccountOrBurner";
import useNftSelection from "@/hooks/useNftSelection";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";

export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const { account } = useAccountOrBurner();
  const [isOpen, setIsOpen] = useState(false);
  const [isRealmMintOpen, setIsRealmMintIsOpen] = useState(false);

  const realms_address = import.meta.env.VITE_REALMS_ADDRESS;
  //const season_pass_address = import.meta.env.VITE_SEASON_PASS_ADDRESS;

  const { data } = useSuspenseQuery({
    queryKey: ["erc721Balance" + account?.address],
    queryFn: () => (account?.address ? execute(GET_REALMS, { accountAddress: account.address }) : null),
    //enabled: !!account?.address,
    refetchInterval: 10_000,
  });
  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    //enabled: !!account?.address,
    refetchInterval: 10_000,
  });

  const seasonPassTokenIds = seasonPassMints?.ercTransfer
    ?.filter(
      (token) =>
        token?.tokenMetadata.contractAddress === import.meta.env.VITE_SEASON_PASS_ADDRESS
    )
    .map((token) => token?.tokenMetadata.tokenId)
    .filter((id): id is string => id !== undefined);

  const realmsErcBalance = data?.ercBalance?.filter((token) => token?.tokenMetadata.contractAddress === realms_address);  

  const {
    deselectAllNfts,
    isNftSelected,
    selectBatchNfts,
    //selectedCollectionAddress,
    toggleNftSelection,
    totalSelectedNfts,
    selectedTokenIds,
  } = useNftSelection({ userAddress: account?.address as `0x${string}` });

  return (
    <div className="flex flex-col h-full">
      {account?.address && (
        <>
          <div className="sticky top-0 z-10">
            <AttributeFilters />
          </div>

          <div className="flex-grow overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton>Loading</Skeleton>}>
                <RealmsGrid
                  isNftSelected={isNftSelected}
                  toggleNftSelection={toggleNftSelection}
                  realms={realmsErcBalance}
                  seasonPassTokenIds={seasonPassTokenIds}
                />
              </Suspense>
            </div>
          </div>
          <div className="flex justify-between border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
            <Button onClick={() => setIsRealmMintIsOpen(true)} variant="cta">
              Mint Realms
            </Button>
            <div className="flex items-center gap-x-4">
              {data?.ercBalance ? (
                <SelectNftActions
                  //selectedTokenIds={selectedTokenIds}
                  totalSelectedNfts={totalSelectedNfts}
                  selectBatchNfts={selectBatchNfts}
                  deselectAllNfts={deselectAllNfts}
                  contractAddress={realmsErcBalance?.[0]?.tokenMetadata.contractAddress ?? ""}
                  batchTokenIds={realmsErcBalance
                    ?.filter((token) => !seasonPassTokenIds?.includes(token?.tokenMetadata.tokenId ?? ''))
                    .map((token) => token?.tokenMetadata?.tokenId ?? "")
                    .filter((tokenId): tokenId is string => tokenId !== "")}
                />
              ) : null}
              <TypeH2>{totalSelectedNfts} Selected</TypeH2>

              <Button disabled={totalSelectedNfts < 1} onClick={() => setIsOpen(true)} variant="cta">
                Mint Season Passes
              </Button>
            </div>
            <SeasonPassMintDialog
              isOpen={isOpen}
              setIsOpen={setIsOpen}
              deselectAllNfts={deselectAllNfts}
              isSuccess={status === "success"}
              realm_ids={selectedTokenIds}
              //selectedRealms={}
            />
            <RealmMintDialog
              totalOwnedRealms={realmsErcBalance?.length}
              isOpen={isRealmMintOpen}
              setIsOpen={setIsRealmMintIsOpen}
            />
          </div>
        </>
      )}
    </div>
  );
}
