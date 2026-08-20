import BridgeIcon from "@/components/icons/bridge.svg?react";
import { OwnershipStatusAlert } from "@/components/modules/realms/ownership-status-alert";
import { RealmCard } from "@/components/modules/realms/realm-card";
import { Button } from "@/components/ui/button";
import { getAccountTokensQueryOptions } from "@/lib/eternum/getPortfolioCollections";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HandCoins } from "lucide-react";

import { CollectionAddresses } from "@realms-world/constants";

export const Route = createFileRoute("/realms/")({
  component: RealmsComponent,
});
function RealmsComponent() {
  const { address } = useAccount();

  const l2RealmsQuery = useQuery(
    getAccountTokensQueryOptions({
      address: address,
      collectionAddress: CollectionAddresses.realms[
        SUPPORTED_L2_CHAIN_ID
      ] as string,
    }),
  );
  const inventory = l2RealmsQuery.data;
  const l2Realms = inventory?.tokens ?? [];
  if (!address) {
    return <div>Connect Starknet Wallet to view your Realms</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex gap-2">
        <Link to={`/realms/bridge`}>
          <Button variant="outline" size="sm">
            <BridgeIcon className="h-5! w-5!" /> Starknet Bridge
          </Button>
        </Link>
        <Link to={`/realms/claims`}>
          <Button variant="outline" size="sm">
            <HandCoins /> Claim Lords
          </Button>
        </Link>
      </div>
      {l2RealmsQuery.isPending ? (
        <div>Loading Realm inventory...</div>
      ) : (
        <OwnershipStatusAlert
          status={inventory?.status}
          isError={l2RealmsQuery.isError}
          onRetry={() => void l2RealmsQuery.refetch()}
        />
      )}
      {inventory?.status === "ready" && !l2RealmsQuery.isError && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {l2Realms.length
            ? l2Realms.map((realm) => {
                return (
                  <RealmCard key={realm.token_id} token={realm} isGrid={true} />
                );
              })
            : "No Realms Found in wallet"}
        </div>
      )}
    </div>
  );
}
