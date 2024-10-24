import { Filters } from "@/components/modules/filters";
import { RealmsGrid } from "@/components/modules/realms-grid";
import { SelectNftActions } from "@/components/modules/select-nft-actions";
import { TypeH2 } from "@/components/typography/type-h2";
import { Button } from "@/components/ui/button";
import { execute } from "@/hooks/gql/execute";
import { GET_REALMS } from "@/hooks/query/realms";
import useAccountOrBurner from "@/hooks/useAccountOrBurner";
import { useMintSeasonPass } from "@/hooks/useMintSeasonPass";
import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import useNftSelection from "@/hooks/useNftSelection";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";


export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const { account } = useAccountOrBurner();

  const { data, error, refetch } = useQuery({
    queryKey: ["erc721Balance"],
    queryFn: () => execute(GET_REALMS, { accountAddress: account?.address! }),
    enabled: !!account?.address,
    refetchInterval: 10_000,
  });

  const realms_address = import.meta.env.VITE_REALMS_ADDRESS;
  const season_pass_address = import.meta.env.VITE_SEASON_PASS_ADDRESS

  const realmsErcBalance = data?.ercBalance?.filter(
    (token) => token?.tokenMetadata.contractAddress === realms_address
  );

  const seasonPassErcBalance = data?.ercBalance?.filter(
    (token) => token?.tokenMetadata.contractAddress === season_pass_address
  );
  const seasonPassTokenIds = new Set(
    seasonPassErcBalance?.map((token) => token.tokenMetadata.tokenId)
  );
  const enrichedRealmsErcBalance = realmsErcBalance?.map((token) => ({
    ...token,
    seasonPassMinted: seasonPassTokenIds.has(token.tokenMetadata.tokenId),
  }));

  const { mint: mintRealm } = useMintTestRealm();
  const { mint: mintSeasonPasses } = useMintSeasonPass();

  // Function to get the highest tokenId
  const getHighestTokenId = () => {
    if (!data?.ercBalance || realmsErcBalance?.length === 0) {
      return null;
    }

    const highest = realmsErcBalance?.reduce((max, item) => {
      const tokenId = BigInt(item.tokenMetadata.tokenId);
      return tokenId > max ? tokenId : max;
    }, BigInt(0));

    return Number(highest); // Convert BigInt to string in decimal
  };

  const highestTokenId = getHighestTokenId();

  const onMintRealm = async () => {
    if (mintRealm) {
      mintRealm((highestTokenId ?? 0) + 1);
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
          <RealmsGrid isNftSelected={isNftSelected} toggleNftSelection={toggleNftSelection} realms={enrichedRealmsErcBalance} />
        </div>
      </div>
      <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        {onMintRealm && (
          <Button variant={"outline"} onClick={() => onMintRealm()}>
            Mint a Realm
          </Button>
        )}
        {data?.ercBalance && <SelectNftActions          
          selectedTokenIds={selectedTokenIds}
          totalSelectedNfts={totalSelectedNfts}
          selectBatchNfts={selectBatchNfts}
          deselectAllNfts={deselectAllNfts}
          contractAddress={realmsErcBalance?.[0]?.tokenMetadata.contractAddress}
          batchTokenIds={data?.ercBalance
            .map((token) => token?.tokenMetadata.tokenId)}
          />}
        <TypeH2>{totalSelectedNfts} Selected</TypeH2>
        {mintSeasonPasses && <Button onClick={()=>mintSeasonPasses(selectedTokenIds)} variant="cta">Mint Season Passes</Button>}
      </div>
    </div>
  );
}
