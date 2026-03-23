import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmPoolRow } from "./amm-pool-row";
import { useQuery } from "@tanstack/react-query";
import { formatTokenAmount, computeSpotPrice, type Pool } from "@bibliothecadao/amm-sdk";

const POOL_NAMES: Record<string, string> = {
  "0x2": "Wood",
  "0x3": "Stone",
  "0x4": "Coal",
  "0x5": "Copper",
  "0x6": "Ironwood",
};

export const AmmPoolList = () => {
  const { client } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const setSelectedPool = useAmmStore((s) => s.setSelectedPool);

  const {
    data: pools,
    isLoading,
    error,
  } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: () => client.api.getPools(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gold/60 text-sm">
        <div className="w-4 h-4 border-t-2 border-gold rounded-full animate-spin mx-auto mb-2" />
        Loading pools...
      </div>
    );
  }

  if (error || !pools || pools.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center text-gold/40 text-sm">No pools available</div>
        <div className="text-center text-gold/30 text-xs mt-1">AMM contracts not yet deployed</div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-3 border-b border-gold/20">
        <h2 className="text-sm font-bold text-gold">Pools</h2>
      </div>
      {pools.map((pool) => {
        const spotPrice = computeSpotPrice(pool.lordsReserve, pool.tokenReserve);
        const tvl = formatTokenAmount(pool.lordsReserve * 2n);
        const name = POOL_NAMES[pool.tokenAddress] ?? pool.tokenAddress.slice(0, 8);

        return (
          <AmmPoolRow
            key={pool.tokenAddress}
            tokenAddress={pool.tokenAddress}
            tokenName={name}
            price={spotPrice.toFixed(4)}
            tvl={tvl}
            isSelected={selectedPool === pool.tokenAddress}
            onClick={() => setSelectedPool(pool.tokenAddress)}
          />
        );
      })}
    </div>
  );
};
