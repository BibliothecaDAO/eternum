import { Suspense } from "react";
import SnapshotLogo from "@/components/icons/snapshot.svg?react";
import { ProposalList } from "@/components/modules/governance/proposal-list";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
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
    <SidebarProvider
      style={{
        "--sidebar-width": "30rem",
        "--sidebar-width-mobile": "20rem",
      }}
    >
      <SidebarInset>
        <div className="container p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <Suspense fallback={<ProposalListSkeleton />}>
            <ProposalList limit={20} delegateId={currentDelegate?.user} />
          </Suspense>
        </div>
      </SidebarInset>
      <Sidebar
        side="right"
        variant="inset"
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>View On</SidebarGroupLabel>
            <a
              target="_blank"
              href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
            >
              <Badge
                variant="outline"
                className="rounded-xl bg-gray-300 hover:bg-gray-100"
              >
                <SnapshotLogo className="h-10 w-36" />
              </Badge>
            </a>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

function ProposalListSkeleton() {
  return (
    <div className="w-full">
      <div className="space-y-0">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-6 w-full max-w-[400px]" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <Skeleton className="h-4 w-full rounded-full sm:w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
