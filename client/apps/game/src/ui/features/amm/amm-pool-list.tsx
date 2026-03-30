import { Button } from "@/ui/design-system/atoms";
import { useAmm } from "@/hooks/use-amm";
import { computeSpotPrice, type Pool } from "@/services/amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmPoolRow } from "./amm-pool-row";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmCompactAmount, formatAmmSpotPrice } from "./amm-format";
import { orderAmmPools, type AmmPoolOrder } from "./amm-model";
import { AMM_READ_QUERY_OPTIONS } from "./amm-queries";

interface AmmPoolListProps {
  className?: string;
  onPoolSelect?: (tokenAddress: string) => void;
  showHeader?: boolean;
}

const POOL_ORDER_OPTIONS: Array<{ orderBy: AmmPoolOrder; label: string }> = [
  { orderBy: "default", label: "Default" },
  { orderBy: "mcap", label: "MCap" },
  { orderBy: "tvl", label: "TVL" },
  { orderBy: "resourceIds", label: "Resource IDs" },
];

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
  const [poolOrder, setPoolOrder] = useState<AmmPoolOrder>("default");

  const {
    data: pools,
    isLoading,
    error,
    refetch,
  } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    ...AMM_READ_QUERY_OPTIONS,
  });

  const { data: marketCapByTokenAddress } = useQuery({
    queryKey: ["amm-pool-ordering", pools?.map((pool) => pool.tokenAddress).join(",")],
    queryFn: async () => {
      if (!client || !pools) {
        return new Map<string, bigint | null>();
      }

      const marketCapEntries = await Promise.all(
        pools.map(async (pool) => {
          const stats = await client.api.getPoolStats(pool.tokenAddress);
          return [pool.tokenAddress, stats?.marketCapLords ?? null] as const;
        }),
      );

      return new Map(marketCapEntries);
    },
    enabled: Boolean(client) && Boolean(pools?.length),
    ...AMM_READ_QUERY_OPTIONS,
  });

  const [search, setSearch] = useState("");

  const orderedPools = useMemo(() => {
    if (!pools) {
      return [];
    }

    return orderAmmPools(pools, {
      lordsAddress: config.lordsAddress,
      orderBy: poolOrder,
      marketCapByTokenAddress: marketCapByTokenAddress ?? new Map<string, bigint | null>(),
    });
  }, [config.lordsAddress, marketCapByTokenAddress, poolOrder, pools]);

  useEffect(() => {
    if (!selectedPool && orderedPools.length > 0) {
      setSelectedPool(orderedPools[0].tokenAddress);
    }
  }, [orderedPools, selectedPool, setSelectedPool]);

  const filteredPools = useMemo(() => {
    if (!search.trim()) return orderedPools;
    const term = search.trim().toLowerCase();
    return orderedPools.filter((pool) => {
      const asset = resolveAmmAssetPresentation(pool.tokenAddress, config.lordsAddress);
      return asset.displayName.toLowerCase().includes(term);
    });
  }, [orderedPools, search, config.lordsAddress]);

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
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-gold/10 bg-black/25 p-3 backdrop-blur-[10px]",
        className,
      )}
    >
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

      <div className="mb-3">
        <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.16em] text-gold/35">Order</div>
        <select
          value={poolOrder}
          onChange={(event) => setPoolOrder(event.target.value as AmmPoolOrder)}
          className="w-full rounded-xl border border-gold/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold outline-none focus:border-gold/25"
        >
          {POOL_ORDER_OPTIONS.map((option) => (
            <option key={option.orderBy} value={option.orderBy}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-2">
          {filteredPools.length === 0 ? (
            <div className="py-4 text-center text-xs text-gold/35">No pools match</div>
          ) : (
            filteredPools.map((pool) => {
              const spotPrice = formatAmmSpotPrice(computeSpotPrice(pool.lordsReserve, pool.tokenReserve));
              const tvl = formatAmmCompactAmount(pool.lordsReserve * 2n);
              const marketCap = formatPoolMarketCap(marketCapByTokenAddress?.get(pool.tokenAddress) ?? null);
              const asset = resolveAmmAssetPresentation(pool.tokenAddress, config.lordsAddress);

              return (
                <AmmPoolRow
                  key={pool.tokenAddress}
                  iconResource={asset.iconResource}
                  marketCap={marketCap}
                  pairLabel="vs LORDS"
                  spotPrice={spotPrice}
                  tokenName={asset.displayName}
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
    </div>
  );
};

function formatPoolMarketCap(marketCap: bigint | null): string {
  return marketCap == null ? "--" : formatAmmCompactAmount(marketCap);
}
