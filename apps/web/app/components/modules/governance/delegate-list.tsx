import { useState } from "react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/router";

import { DelegateCard } from "./delegate-card";
import { DelegateListActions } from "./delegate-list-actions";

function DelegateList() {
  // Local state for the search string.
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState<"desc" | "random">("random");

  const delegatesQuery = trpc.delegates.all.useQuery({
    search: searchQuery,
    orderBy: sortMethod,
  });
  const delegates = delegatesQuery.data?.items ?? [];

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

      {/* Delegates grid */}
      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
        {delegates.map((delegate) => (
          <DelegateCard key={delegate.id} delegate={delegate} />
        ))}
      </div>
    </div>
  );
}

export default DelegateList;
