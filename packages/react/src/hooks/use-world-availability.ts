import {
  fetchWorldConfigMeta,
  isToriiAvailable,
  toriiBaseUrlFromName,
  type WorldConfigMeta,
} from "@bibliothecadao/world";
import { useQueries, useQuery } from "@tanstack/react-query";

export interface WorldAvailability {
  worldName: string;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

const checkWorldAvailability = async (
  worldName: string,
  cartridgeApiBase?: string,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const toriiBaseUrl = toriiBaseUrlFromName(worldName, cartridgeApiBase);
  const isAvailable = await isToriiAvailable(toriiBaseUrl);

  if (!isAvailable) {
    return { isAvailable: false, meta: null };
  }

  const meta = await fetchWorldConfigMeta(toriiBaseUrl);
  return { isAvailable: true, meta };
};

export const useWorldAvailability = (
  worldName: string | null,
  enabled: boolean = true,
  options?: { cartridgeApiBase?: string },
) => {
  const query = useQuery({
    queryKey: ["worldAvailability", worldName, options?.cartridgeApiBase],
    queryFn: () => checkWorldAvailability(worldName!, options?.cartridgeApiBase),
    enabled: enabled && !!worldName,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  return {
    isAvailable: query.data?.isAvailable ?? false,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
};

export const useWorldsAvailability = (
  worldNames: string[],
  enabled: boolean = true,
  options?: { cartridgeApiBase?: string },
) => {
  const queries = useQueries({
    queries: worldNames.map((worldName) => ({
      queryKey: ["worldAvailability", worldName, options?.cartridgeApiBase],
      queryFn: () => checkWorldAvailability(worldName, options?.cartridgeApiBase),
      enabled: enabled && !!worldName,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    })),
  });

  const results: Map<string, WorldAvailability> = new Map();

  queries.forEach((query, index) => {
    const worldName = worldNames[index];
    results.set(worldName, {
      worldName,
      isAvailable: query.data?.isAvailable ?? false,
      meta: query.data?.meta ?? null,
      isLoading: query.isLoading,
      error: (query.error as Error) || null,
    });
  });

  const isAnyLoading = queries.some((query) => query.isLoading);
  const allSettled = queries.every((query) => !query.isLoading);

  return {
    results,
    isAnyLoading,
    allSettled,
    refetchAll: () => Promise.all(queries.map((query) => query.refetch())),
  };
};

export const getAvailabilityStatus = (availability: WorldAvailability | undefined): "checking" | "ok" | "fail" => {
  if (!availability) return "checking";
  if (availability.isLoading) return "checking";
  return availability.isAvailable ? "ok" : "fail";
};
