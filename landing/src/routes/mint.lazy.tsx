import { Filters } from "@/components/modules/filters";
import { RealmsGrid } from "@/components/modules/realms-grid";
import { SeasonPass } from "@/components/modules/season-pass";
import { TypeH2 } from "@/components/typography/type-h2";
import { Button } from "@/components/ui/button";
import { execute } from "@/hooks/gql/execute";
import { GET_REALMS } from "@/hooks/query/realms";
import useAccountOrBurner from "@/hooks/useAccountOrBurner";
import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";

// TODO: Move to backend
const realms = [
  {
    title: "l'unpik",
    owner: "0x1234...5678",
    name: "Crimson Blade",
  },
  {
    title: "l'éclaireur",
    owner: "0xabcd...ef01",
    name: "Shadow Walker",
  },
];
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
    refetchInterval: 10_000
  });

  console.log(data);

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

  const mintRealm = async() => {
    if(mint){
      mint((highestTokenId ?? 0) + 1); 
      refetch()
    }
  }

  console.log("Highest Token ID:", highestTokenId);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <Filters />
      </div>
      {error?.message}

      <div className="flex-grow overflow-y-auto">
        {mint && <Button onClick={() => mintRealm()}>Mint a Realm</Button>}
        <div className="flex flex-col gap-2">
          <RealmsGrid realms={data?.ercBalance} />
        </div>
      </div>
      <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        <TypeH2>10 Selected</TypeH2>
        <Button /*onClick={mintRealmPasses}*/ variant="cta">Mint Season Passes</Button>
      </div>
      {/* Display Highest Token ID */}
      <div className="mt-4">
        <TypeH2>Highest Token ID: {highestTokenId ?? "N/A"}</TypeH2>
      </div>
    </div>
  );
}
