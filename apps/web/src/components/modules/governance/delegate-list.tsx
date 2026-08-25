import { getDelegatesQueryOptions } from "@/lib/getDelegates";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DelegateCard } from "./delegate-card";

function DelegateList({
  searchQuery,
  sortMethod,
}: {
  sortMethod: "desc" | "random";
  searchQuery: string;
}) {
  const delegatesQuery = useSuspenseQuery(
    getDelegatesQueryOptions({
      limit: 200,
      cursor: 0,
      search: searchQuery.toLowerCase(),
      orderBy: sortMethod,
    }),
  );
  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
      {delegatesQuery.data.items.map((delegate) => (
        <DelegateCard key={delegate.id} delegate={delegate} />
      ))}
    </div>
  );
}

export default DelegateList;
