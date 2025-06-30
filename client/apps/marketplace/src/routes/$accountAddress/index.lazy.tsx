import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import { marketplaceCollections } from "@/config";
import { fetchTokenBalancesWithMetadata } from "@/hooks/services";
import { displayAddress } from "@/lib/utils";
import { useQueries } from "@tanstack/react-query";
import { createLazyFileRoute, useParams } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/$accountAddress/")({
  component: AccountProfilePage,
  pendingComponent: FullPageLoader,
});

export default function AccountProfilePage() {
  const { accountAddress } = useParams({ strict: false }) as { accountAddress: string };

  // Prepare queries for each collection
  const collectionEntries = Object.entries(marketplaceCollections);
  const queries = useQueries({
    queries: collectionEntries.map(([, collection]) => ({
      queryKey: ["ownedTokens", collection.address, accountAddress],
      queryFn: () => fetchTokenBalancesWithMetadata(collection.address, accountAddress),
      enabled: !!accountAddress,
    })),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Account Profile</h1>
      <div className="mb-8">
        <div className="text-lg font-mono text-muted-foreground break-all">{displayAddress(accountAddress)}</div>
      </div>
      {collectionEntries.map(([key, collection], idx) => {
        const { data, isLoading, error } = queries[idx];
        return (
          <div key={key} className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <img src={collection.image} alt={collection.name} className="w-10 h-10 rounded" />
              <h2 className="text-2xl font-semibold">{collection.name}</h2>
            </div>
            {isLoading && <div className="text-muted-foreground">Loading...</div>}
            {error && <div className="text-destructive">Error loading tokens.</div>}
            {!isLoading && !error && <CollectionTokenGrid tokens={data || []} pageId={`profile-${key}`} />}
          </div>
        );
      })}
    </div>
  );
}
