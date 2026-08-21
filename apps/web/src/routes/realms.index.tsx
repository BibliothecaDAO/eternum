import BridgeIcon from "@/components/icons/bridge.svg?react";
import { OwnershipStatusAlert } from "@/components/modules/realms/ownership-status-alert";
import { RealmCard } from "@/components/modules/realms/realm-card";
import { Button } from "@/components/ui/button";
import { getRealmInventoryQueryOptions } from "@/lib/realms/get-realm-inventory";
import { getRealmInventoryViewState } from "@/lib/realms/inventory-ui";
import { useAccount } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HandCoins } from "lucide-react";

export const Route = createFileRoute("/realms/")({
  component: RealmsComponent,
});
function RealmsComponent() {
  const { address } = useAccount();

  const l2RealmsQuery = useQuery(
    getRealmInventoryQueryOptions({
      address: address,
    }),
  );
  const inventory = l2RealmsQuery.data;
  const l2Realms = inventory?.tokens ?? [];
  const inventoryViewState = getRealmInventoryViewState({
    isPending: l2RealmsQuery.isPending,
    isError: l2RealmsQuery.isError,
    status: inventory?.status,
  });
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
      {inventoryViewState === "loading" ? (
        <div>Loading Realm inventory...</div>
      ) : (
        <OwnershipStatusAlert
          status={inventory?.status}
          isError={inventoryViewState === "error"}
          onRetry={() => void l2RealmsQuery.refetch()}
        />
      )}
      {inventoryViewState === "ready" && (
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
