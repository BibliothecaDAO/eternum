import { Suspense } from "react";
import { ProposalList } from "@/components/modules/governance/proposal-list";
import { Skeleton } from "@/components/ui/skeleton";
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
      <Suspense fallback={<ProposalListSkeleton />}>
        <div className="grid md:grid-cols-5">
          <div className="col-span-3 w-full">
            <ProposalList limit={20} delegateId={currentDelegate?.user} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}

function ProposalListSkeleton() {
  return (
    <div className="grid md:grid-cols-5">
      <div className="col-span-3 w-full">
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="mx-4 flex items-center border-b py-[14px]"
            >
              <div className="mr-4 w-0 flex-auto">
                <div className="flex space-x-2">
                  <div className="mb-1 items-center leading-6 md:flex md:min-w-0">
                    <Skeleton className="h-6 w-64" />
                  </div>
                </div>
                <div className="mr-4">
                  <Skeleton className="inline-block h-4 w-24 align-middle" />
                </div>
                <div className="text-muted-foreground space-x-4">
                  <Skeleton className="mx-1 inline-block h-4 w-20 align-middle" />
                  <Skeleton className="mx-1 inline-block h-4 w-20 align-middle" />
                  <Skeleton className="mx-1 inline-block h-4 w-32 align-middle" />
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Skeleton className="w-30 h-4 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
