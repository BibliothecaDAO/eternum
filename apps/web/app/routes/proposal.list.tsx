import { Suspense } from "react";
import { ProposalList } from "@/components/modules/governance/proposal-list";
import { useCurrentDelegate } from "@/hooks/governance/use-current-delegate";
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { formatAddress } from "@/utils/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { num } from "starknet";

export const Route = createFileRoute("/proposal/list")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useCurrentDelegate();

  const currentDelegateQuery = useSuspenseQuery(
    getDelegateByIDQueryOptions({
      address: formatAddress(num.toHex(BigInt(data ?? 0))),
    }),
  );
  const currentDelegate = currentDelegateQuery.data;

  return (
    <div className="container p-6">
      <h1 className="pl-4 text-2xl font-semibold">Proposals</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="grid md:grid-cols-5">
          <div className="col-span-3 w-full">
            <ProposalList limit={20} delegateId={currentDelegate?.user} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
