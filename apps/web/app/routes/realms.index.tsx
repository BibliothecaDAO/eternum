import { RealmCard } from "@/components/modules/realms/realm-card";
import { Card } from "@/components/ui/card";
import { marketPlaceClientBuilder } from "@/lib/ark/client";
import { ChainId, CollectionAddresses } from "@/lib/contracts";
import { realmsQueryOptions } from "@/queryOptions/realmsQueryOptions";
import { useAccount } from "@starknet-react/core";
import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  ErrorComponent,
  ErrorComponentProps,
  useRouter,
} from "@tanstack/react-router";
import React from "react";

export class RealmsNotFoundError extends Error {}

export const Route = createFileRoute("/realms/")({
 
  errorComponent: PostErrorComponent,
  component: RealmsComponent,
});
export function PostErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  if (error instanceof RealmsNotFoundError) {
    return <div>{error.message}</div>;
  }
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  React.useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <div>
      <button
        onClick={() => {
          router.invalidate();
        }}
      >
        retry
      </button>
      <ErrorComponent error={error} />
    </div>
  );
}
function RealmsComponent() {
  //const postId = Route.useParams().postId
  const arkClient = marketPlaceClientBuilder(window.fetch.bind(window));
  const {address} = useAccount()

  const { data: realms } = useSuspenseQuery(
    realmsQueryOptions({
      walletAddress: address,
      client: arkClient,
      collectionAddress: CollectionAddresses.realms[ChainId.SN_MAIN] as string,
    })
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4">
      {realms?.data.map((realm) => {
        return (
          <RealmCard key={realm.token_id} token={realm} isGrid={true} />
        );
      })}
    </div>
  );
}
