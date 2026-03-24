import { Button } from "@/ui/design-system/atoms";
import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmPoolRow } from "./amm-pool-row";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatTokenAmount, computeSpotPrice, type Pool } from "@bibliothecadao/amm-sdk";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmCompactAmount, formatAmmSpotPrice } from "./amm-format";

interface AmmPoolListProps {
  className?: string;
  onPoolSelect?: (tokenAddress: string) => void;
  showHeader?: boolean;
}

const LoadingSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="h-[60px] animate-pulse rounded-2xl border border-gold/10 bg-gold/6" />
    ))}
  </div>
);

function resolveIndexerHost(indexerUrl: string): string {
  try {
    return new URL(indexerUrl).host;
  } catch {
    return indexerUrl;
  }
}

export const AmmPoolList = ({ className, onPoolSelect, showHeader = true }: AmmPoolListProps) => {
  const { client, config, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const setSelectedPool = useAmmStore((s) => s.setSelectedPool);

  const {
    data: pools,
    isLoading,
    error,
    refetch,
  } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selectedPool && pools && pools.length > 0) {
      setSelectedPool(pools[0].tokenAddress);
    }
  }, [pools, selectedPool, setSelectedPool]);

  const [search, setSearch] = useState("");

  const filteredPools = useMemo(() => {
    if (!pools) return [];
    if (!search.trim()) return pools;
    const term = search.trim().toLowerCase();
    return pools.filter((pool) => {
      const asset = resolveAmmAssetPresentation(pool.tokenAddress, config.lordsAddress);
      return asset.displayName.toLowerCase().includes(term);
    });
  }, [pools, search, config.lordsAddress]);

  if (!isConfigured || !client) {
    return (
      <div className={cn("rounded-2xl border border-gold/10 bg-black/25 p-4 backdrop-blur-[8px]", className)}>
        <div className="text-center text-sm text-gold/40">The Agora is not configured</div>
        <div className="mt-1 text-center text-xs text-gold/30">Set the public Agora env vars to load pools</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3 rounded-2xl border border-gold/10 bg-black/25 p-4 backdrop-blur-[8px]", className)}>
        {showHeader && (
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/55">Pools</h2>
            <span className="text-[11px] uppercase tracking-[0.14em] text-gold/35">Loading</span>
          </div>
        )}
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-danger/20 bg-black/30 p-4 backdrop-blur-[8px]", className)}>
        <div className="text-sm font-medium text-danger">Could not load pools</div>
        <div className="mt-1 text-xs text-gold/45">Fetcher failed against {resolveIndexerHost(config.indexerUrl)}.</div>
        <Button
          variant="outline"
          forceUppercase={false}
          size="xs"
          className="mt-3 w-full rounded-xl border-gold/20 bg-transparent text-gold hover:bg-gold/10"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!pools || pools.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-gold/10 bg-black/25 p-4 backdrop-blur-[8px]", className)}>
        <div className="text-sm text-gold/45">No pools seeded yet</div>
        <div className="mt-1 text-xs text-gold/30">
          The connected Agora indexer is up, but it is not serving any pool rows.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-gold/10 bg-black/25 p-3 backdrop-blur-[10px]", className)}>
      {showHeader && (
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/55">Pools</h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-gold/35">{pools.length} live</span>
        </div>
      )}

      <input
        type="text"
        placeholder="Search pools..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full rounded-xl border border-gold/10 bg-black/30 px-3 py-2 text-xs text-gold placeholder:text-gold/30 outline-none focus:border-gold/25"
      />

      <div className="space-y-2">
        {filteredPools.length === 0 ? (
          <div className="py-4 text-center text-xs text-gold/35">No pools match</div>
        ) : (
          filteredPools.map((pool) => {
            const spotPrice = computeSpotPrice(pool.lordsReserve, pool.tokenReserve);
            const tvl = formatAmmCompactAmount(pool.lordsReserve * 2n);
            const asset = resolveAmmAssetPresentation(pool.tokenAddress, config.lordsAddress);

            return (
              <AmmPoolRow
                key={pool.tokenAddress}
                iconResource={asset.iconResource}
                pairLabel="vs LORDS"
                tokenName={asset.displayName}
                price={formatAmmSpotPrice(spotPrice)}
                tvl={tvl}
                isSelected={selectedPool === pool.tokenAddress}
                onClick={() => {
                  setSelectedPool(pool.tokenAddress);
                  onPoolSelect?.(pool.tokenAddress);
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
