import { useQuery, useQueries } from "@tanstack/react-query";
import type { WorldRef, WorldAvailability } from "../types";
import { getWorldKey } from "../utils/chain-utils";
import { checkWorldAvailability } from "../utils/factory-query";

export interface UseWorldAvailabilityOptions {
  enabled?: boolean;
  cartridgeApiBase?: string;
}

/**
 * Hook to check a single world's availability with caching.
 * Results are cached for 5 minutes.
 */
export function useWorldAvailability(world: WorldRef | null, options: UseWorldAvailabilityOptions = {}) {
  const { enabled = true, cartridgeApiBase } = options;
  const worldName = world?.name ?? null;
  const worldKey = world ? getWorldKey(world) : null;

  const query = useQuery({
    queryKey: ["worldAvailability", worldKey, cartridgeApiBase],
    queryFn: () => checkWorldAvailability(worldName!, cartridgeApiBase),
    enabled: enabled && !!worldName,
    staleTime: 5 * 60 * 1000, // 5 minutes - worlds don't go online/offline frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
  });

  return {
    worldKey: worldKey ?? "",
    worldName: worldName ?? "",
    chain: world?.chain,
    isAvailable: query.data?.isAvailable ?? false,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to check multiple worlds' availability with batched queries.
 * Uses React Query's useQueries for parallel execution with caching.
 * Results are cached for 5 minutes.
 */
export function useWorldsAvailability(worlds: WorldRef[], options: UseWorldAvailabilityOptions = {}) {
  const { enabled = true, cartridgeApiBase } = options;

  const queries = useQueries({
    queries: worlds.map((world) => ({
      queryKey: ["worldAvailability", getWorldKey(world), cartridgeApiBase],
      queryFn: () => checkWorldAvailability(world.name, cartridgeApiBase),
      enabled: enabled && !!world.name,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
    })),
  });

  const results: Map<string, WorldAvailability> = new Map();

  queries.forEach((query, index) => {
    const world = worlds[index];
    const worldKey = getWorldKey(world);
    results.set(worldKey, {
      worldKey,
      worldName: world.name,
      chain: world.chain,
      isAvailable: query.data?.isAvailable ?? false,
      meta: query.data?.meta ?? null,
      isLoading: query.isLoading,
      error: query.error as Error | null,
    });
  });

  const isAnyLoading = queries.some((q) => q.isLoading);
  const allSettled = queries.every((q) => !q.isLoading);

  return {
    results,
    isAnyLoading,
    allSettled,
    refetchAll: () => Promise.all(queries.map((q) => q.refetch())),
  };
}

/**
 * Get availability status string for a world.
 */
export function getAvailabilityStatus(availability: WorldAvailability | undefined): "checking" | "ok" | "fail" {
  if (!availability) return "checking";
  if (availability.isLoading) return "checking";
  return availability.isAvailable ? "ok" : "fail";
}
