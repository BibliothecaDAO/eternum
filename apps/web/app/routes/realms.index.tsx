import { RealmCard } from "@/components/modules/realms/realm-card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/router";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { CollectionAddresses } from "@realms-world/constants";
import { useAccount } from "@starknet-react/core";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type {
  ErrorComponentProps} from "@tanstack/react-router";
import {
  createFileRoute,
  ErrorComponent,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { HandCoins, Ship } from "lucide-react";
import React from "react";

export class RealmsNotFoundError extends Error {}

export const Route = createFileRoute("/realms/")({
  errorComponent: PostErrorComponent,
  component: RealmsComponent,
});
export function PostErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  React.useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  if (error instanceof RealmsNotFoundError) {
    return <div>{error.message}</div>;
  }

  return (
    <div>
      <button
        onClick={async() => {
          await router.invalidate();
        }}
      >
        retry
      </button>
      <ErrorComponent error={error} />
    </div>
  );
}
function RealmsComponent() {
  const { address } = useAccount();

  const l2RealmsQuery = trpc.realms.useQuery(
    {
      address: address,
      collectionAddress: CollectionAddresses.realms[
        SUPPORTED_L2_CHAIN_ID
      ] as string,
    },
    { refetchInterval: 10000 }
  );
  const l2Realms = l2RealmsQuery.data;

  if (!address) {
    return <div>Connect Starknet Wallet to view your Realms</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex gap-2">
        <Link to={`/realms/bridge`}>
          <Button variant={"outline"} size="lg" className="rounded px-3">
            <Ship /> Starknet Bridge
          </Button>
        </Link>
        <Link to={`/claims/realms`}>
          <Button variant={"outline"} size="lg" className="rounded px-3">
            <HandCoins /> Claim Lords Rewards
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4">
        {l2Realms?.data.length
          ? l2Realms.data.map((realm) => {
              return (
                <RealmCard key={realm.token_id} token={realm} isGrid={true} />
              );
            })
          : "No Realms Found in wallet"}
      </div>
    </div>
  );
}
