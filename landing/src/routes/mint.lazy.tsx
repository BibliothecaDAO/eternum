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
interface GetRealmsVariables {
  accountAddress: string;
}

interface Realm {
  id: string;
  name: string;
  // other fields...
}

interface GetRealmsData {
  realms: Realm[];
}
export const Route = createLazyFileRoute("/mint")({
  component: Mint,
});

function Mint() {
  const [selectedRealms, setSelectedRealms] = useState<SeasonPass | null>(null);

  const { account } = useAccountOrBurner();

  const { data, error } = useQuery({
    queryKey: ["erc721Balance"],
    queryFn: () => execute(GET_REALMS, { accountAddress: account?.address }),
    enabled: !!account?.address,
  });

  console.log(data);

  const { mint } = useMintTestRealm();

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <Filters />
      </div>
      {error?.message}

      <div className="flex-grow overflow-y-auto">
        {mint && <Button onClick={() => mint()}>Mint a Realm</Button>}
        <div className="flex flex-col gap-2">
          <RealmsGrid realms={realms} />
        </div>
      </div>
      <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        <TypeH2>10 Selected</TypeH2>
        <Button /*onClick={mintRealmPasses}*/ variant="cta">Mint Season Passes</Button>
      </div>
    </div>
  );
}
