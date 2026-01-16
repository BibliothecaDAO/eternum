import { FullPageLoader } from "@/components/modules/full-page-loader";
import { Button } from "@/components/ui/button";
import { marketplaceCollections } from "@/config";
import { fetchSingleCollectionToken } from "@/hooks/services";
import { cn } from "@/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/trade/$collection/$tokenId")({
  component: TokenDetailPage,
  pendingComponent: FullPageLoader,
}) as any;

function TokenDetailPage() {
  const params = Route.useParams();
  const collection = params.collection as string;
  const tokenId = params.tokenId as string;
  const collectionConfig = marketplaceCollections[collection as keyof typeof marketplaceCollections];
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  if (!collectionConfig) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Collection not found</h2>
          <Link to="/trade" className="text-primary hover:underline">
            Go back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const tokenData = useSuspenseQuery({
    queryKey: ["singleToken", collection, tokenId],
    queryFn: () => fetchSingleCollectionToken(collectionConfig.address, tokenId, collectionConfig.id || 0),
    refetchInterval: 8_000,
  });

  const token = tokenData.data;

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Token not found</h2>
          <Link to="/trade/$collection" params={{ collection }} className="text-primary hover:underline">
            Go back to {collection}
          </Link>
        </div>
      </div>
    );
  }

  const metadata = token.metadata;
  const image = metadata?.image?.startsWith("ipfs://")
    ? metadata?.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : metadata?.image;

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <Link to="/trade/$collection" params={{ collection }}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to {collection}</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Image Section */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-lg bg-muted">
            {image ? (
              <img src={image} alt={metadata?.name || `Token #${token.token_id}`} className="w-full h-auto" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-muted-foreground">
                No image available
              </div>
            )}
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{metadata?.name || `${collection} #${token.token_id}`}</h1>
            {metadata?.description && (
              <div className="relative">
                <p
                  className={cn(
                    "text-muted-foreground transition-all duration-300",
                    !isDescriptionExpanded && metadata.description.length > 200 && "line-clamp-3",
                  )}
                >
                  {metadata.description}
                </p>
                {metadata.description.length > 200 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {isDescriptionExpanded ? (
                      <>
                        Show less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Price and Status */}
          <div className="p-6 rounded-lg border bg-card">
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <p className="text-lg font-semibold">{token.is_listed ? "Listed" : "Not Listed"}</p>
              </div>

              {token.is_listed && token.best_price_hex !== null && (
                <div>
                  <span className="text-sm text-muted-foreground">Current Price</span>
                  <p className="text-2xl font-bold">{formatUnits(token.best_price_hex || BigInt(0), 18)} LORDS</p>
                </div>
              )}

              {token.token_owner && (
                <div>
                  <span className="text-sm text-muted-foreground">Owner</span>
                  <p className="text-sm font-mono break-all">{token.token_owner}</p>
                </div>
              )}

              {token.is_listed && (
                <Button className="w-full" size="lg">
                  Buy Now
                </Button>
              )}
            </div>
          </div>

          {/* Attributes */}
          {metadata?.attributes && metadata.attributes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Attributes</h2>
              <div className="max-h-96 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {metadata.attributes.map((attr, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                    >
                      <p className="text-xs text-muted-foreground uppercase truncate" title={attr.trait_type}>
                        {attr.trait_type}
                      </p>
                      <p className="font-semibold truncate" title={String(attr.value)}>
                        {attr.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Token Info */}
          <div className="space-y-2 text-sm p-4 rounded-lg border bg-muted/50">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Token ID</span>
              <span className="font-mono">{token.token_id}</span>
            </div>
            <div className="flex justify-between items-start gap-4">
              <span className="text-muted-foreground whitespace-nowrap">Contract</span>
              <span className="font-mono text-xs break-all text-right">{token.contract_address}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
