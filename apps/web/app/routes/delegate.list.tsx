import { Suspense, useState } from "react";
import { DelegateCardSkeleton } from "@/components/modules/governance/delegate-card-skeleton";
import DelegateList from "@/components/modules/governance/delegate-list";
import { DelegateListActions } from "@/components/modules/governance/delegate-list-actions";
import { Input } from "@/components/ui/input";
import { getDelegatesQueryOptions } from "@/lib/getDelegates";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegate/list")({
  component: RouteComponent,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      getDelegatesQueryOptions({
        limit: 200,
        cursor: 0,
        search: "",
        orderBy: "random",
      }),
    );
  },
});

function RouteComponent() {
  // Local state for the search string.
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState<"desc" | "random">("random");

  return (
    <div className="h-screen overflow-auto">
      {/* Sticky search input */}
      <div className="bg-background top-0 z-10 mb-4 flex justify-between gap-6 border-b p-3 sm:sticky">
        <Input
          type="text"
          className="h-12 w-full rounded border p-3"
          placeholder="Search delegate address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <DelegateListActions onSortChange={setSortMethod} />
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <DelegateCardSkeleton key={index} />
            ))}
          </div>
        }
      >
        <DelegateList searchQuery={searchQuery} sortMethod={sortMethod} />
      </Suspense>
    </div>
  );
}
