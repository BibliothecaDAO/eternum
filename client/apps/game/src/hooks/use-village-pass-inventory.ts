import { useCallback, useEffect, useMemo, useState } from "react";
import { RpcProvider } from "starknet";
import type { Chain } from "@contracts";
import { getRpcUrlForChain } from "@/ui/features/admin/constants";

export interface VillagePassInventoryItem {
  tokenId: bigint;
}

interface UseVillagePassInventoryProps {
  chain: Chain;
  ownerAddress?: string | null;
  villagePassAddress?: string | null;
  rpcUrl?: string | null;
  enabled?: boolean;
  refetchIntervalMs?: number;
}

interface UseVillagePassInventoryReturn {
  villagePassBalance: bigint;
  villagePasses: VillagePassInventoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const parseUint256 = (result: string[] | undefined): bigint => {
  if (!result || result.length < 2) return 0n;
  const low = BigInt(result[0] ?? 0);
  const high = BigInt(result[1] ?? 0);
  return low + (high << 128n);
};

export const useVillagePassInventory = ({
  chain,
  ownerAddress,
  villagePassAddress,
  rpcUrl,
  enabled = true,
  refetchIntervalMs = 15_000,
}: UseVillagePassInventoryProps): UseVillagePassInventoryReturn => {
  const [villagePassBalance, setVillagePassBalance] = useState(0n);
  const [villagePasses, setVillagePasses] = useState<VillagePassInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const resolvedRpcUrl = useMemo(() => {
    const customRpcUrl = rpcUrl?.trim();
    if (customRpcUrl) return customRpcUrl;
    return getRpcUrlForChain(chain);
  }, [chain, rpcUrl]);

  const provider = useMemo(() => new RpcProvider({ nodeUrl: resolvedRpcUrl }), [resolvedRpcUrl]);

  const refetch = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled || refetchIntervalMs <= 0) return;
    const timer = window.setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, refetchIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, refetchIntervalMs]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !ownerAddress || !villagePassAddress) {
      setVillagePassBalance(0n);
      setVillagePasses([]);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const balanceResult = await provider.callContract({
          contractAddress: villagePassAddress,
          entrypoint: "balance_of",
          calldata: [ownerAddress],
        });
        const balance = parseUint256(balanceResult as string[]);
        if (!cancelled) {
          setVillagePassBalance(balance);
        }

        if (balance === 0n) {
          if (!cancelled) {
            setVillagePasses([]);
          }
          return;
        }

        const items: VillagePassInventoryItem[] = [];

        for (let index = 0n; index < balance; index += 1n) {
          const tokenResult = await provider.callContract({
            contractAddress: villagePassAddress,
            entrypoint: "token_of_owner_by_index",
            calldata: [ownerAddress, index.toString(), "0"],
          });
          const tokenId = parseUint256(tokenResult as string[]);
          items.push({ tokenId });
        }

        if (!cancelled) {
          const sorted = items.toSorted((a, b) => {
            if (a.tokenId === b.tokenId) return 0;
            return a.tokenId < b.tokenId ? -1 : 1;
          });
          setVillagePasses(sorted);
        }
      } catch (loadError) {
        if (!cancelled) {
          setVillagePasses([]);
          const message = loadError instanceof Error ? loadError.message : "Failed to load village passes.";
          const normalizedMessage = message.toLowerCase();
          if (normalizedMessage.includes("token_of_owner_by_index") || normalizedMessage.includes("entry point")) {
            setError("Village pass detected, but this contract does not expose token enumeration.");
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, ownerAddress, provider, refreshTick, villagePassAddress]);

  return {
    villagePassBalance,
    villagePasses,
    isLoading,
    error,
    refetch,
  };
};
