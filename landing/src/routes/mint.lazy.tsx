import { Filters } from "@/components/modules/filters";
import { RealmsGrid } from "@/components/modules/realms-grid";
import { SeasonPass } from "@/components/modules/season-pass";
import { SelectNftActions } from "@/components/modules/select-nft-actions";
import { TypeH2 } from "@/components/typography/type-h2";
import { Button } from "@/components/ui/button";
import { execute } from "@/hooks/gql/execute";
import { GET_REALMS } from "@/hooks/query/realms";
import useAccountOrBurner from "@/hooks/useAccountOrBurner";
import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import useNftSelection from "@/hooks/useNftSelection";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";


export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const [selectedRealms, setSelectedRealms] = useState<SeasonPass | null>(null);

  const { account } = useAccountOrBurner();

  const { data, error, refetch } = useQuery({
    queryKey: ["erc721Balance"],
    queryFn: () => execute(GET_REALMS, { accountAddress: account?.address! }),
    enabled: !!account?.address,
    refetchInterval: 10_000,
  });


  const { mint } = useMintTestRealm();

  // Function to get the highest tokenId
  const getHighestTokenId = () => {
    if (!data?.ercBalance || data.ercBalance.length === 0) {
      return null;
    }

    const highest = data.ercBalance.reduce((max, item) => {
      const tokenId = BigInt(item.tokenMetadata.tokenId);
      return tokenId > max ? tokenId : max;
    }, BigInt(0));

    return Number(highest); // Convert BigInt to string in decimal
  };

  const highestTokenId = getHighestTokenId();

  const mintRealm = async () => {
    if (mint) {
      mint((highestTokenId ?? 0) + 1);
      refetch();
    }
  };

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
      <div className="sticky top-0 z-10">
        <Filters />
      </div>
      {error?.message}

      <div className="flex-grow overflow-y-auto">
        <div className="flex flex-col gap-2">
          <RealmsGrid isNftSelected={isNftSelected} toggleNftSelection={toggleNftSelection} realms={data?.ercBalance} />
        </div>
      </div>
      <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        {mint && (
          <Button variant={"outline"} onClick={() => mintRealm()}>
            Mint a Realm
          </Button>
        )}
        {data?.ercBalance && <SelectNftActions          
          selectedTokenIds={selectedTokenIds}
          totalSelectedNfts={totalSelectedNfts}
          selectBatchNfts={selectBatchNfts}
          deselectAllNfts={deselectAllNfts}
          contractAddress={data?.ercBalance[0]?.tokenMetadata.contractAddress}
          batchTokenIds={data?.ercBalance
            .map((token) => token?.tokenMetadata.tokenId)}
          />}
        <TypeH2>{totalSelectedNfts} Selected</TypeH2>
        <Button /*onClick={mintRealmPasses}*/ variant="cta">Mint Season Passes</Button>
      </div>
    </div>
  );
}
