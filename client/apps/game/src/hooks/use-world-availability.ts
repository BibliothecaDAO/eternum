/**
 * Cached world availability checks using React Query.
 * This eliminates N+1 request patterns when checking multiple worlds
 * by caching results and sharing them across components.
 */
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { useQuery, useQueries } from "@tanstack/react-query";

const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "blitz_registration_config.registration_count" AS registration_count FROM "s1_eternum-WorldConfig" LIMIT 1;`;

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

export interface WorldConfigMeta {
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
}

export interface WorldRef {
  name: string;
  chain?: string;
}

export const getWorldKey = (world: WorldRef): string => (world.chain ? `${world.chain}:${world.name}` : world.name);

export interface WorldAvailability {
  worldKey: string;
  worldName: string;
  chain?: string;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch world config metadata from Torii SQL endpoint.
 * Cached by React Query.
 */
const fetchWorldConfigMeta = async (toriiBaseUrl: string): Promise<WorldConfigMeta> => {
  const meta: WorldConfigMeta = {
    startMainAt: null,
    endAt: null,
    registrationCount: null,
  };

  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) return meta;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (row) {
      if (row.start_main_at != null) meta.startMainAt = parseMaybeHexToNumber(row.start_main_at) ?? null;
      if (row.end_at != null) meta.endAt = parseMaybeHexToNumber(row.end_at);
      if (row.registration_count != null) meta.registrationCount = parseMaybeHexToNumber(row.registration_count);
    }
  } catch {
    // ignore fetch errors; caller handles defaults
  }
  return meta;
};

/**
 * Check world availability and fetch metadata in one query.
 * Results are cached for 5 minutes to avoid repeated checks.
 */
const checkWorldAvailability = async (
  worldName: string,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const toriiBaseUrl = buildToriiBaseUrl(worldName);
  const isAvailable = await isToriiAvailable(toriiBaseUrl);

  if (!isAvailable) {
    return { isAvailable: false, meta: null };
  }

  const meta = await fetchWorldConfigMeta(toriiBaseUrl);
  return { isAvailable: true, meta };
};

/**
 * Hook to check a single world's availability with caching.
 * Results are cached for 5 minutes.
 */
export const useWorldAvailability = (world: WorldRef | null, enabled = true) => {
  const worldName = world?.name ?? null;
  const worldKey = world ? getWorldKey(world) : null;
  const query = useQuery({
    queryKey: ["worldAvailability", worldKey],
    queryFn: () => checkWorldAvailability(worldName!),
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
};

/**
 * Hook to check multiple worlds' availability with batched queries.
 * Uses React Query's useQueries for parallel execution with caching.
 * Results are cached for 5 minutes.
 */
export const useWorldsAvailability = (worlds: WorldRef[], enabled = true) => {
  const queries = useQueries({
    queries: worlds.map((world) => ({
      queryKey: ["worldAvailability", getWorldKey(world)],
      queryFn: () => checkWorldAvailability(world.name),
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
};

/**
 * Get availability status string for a world.
 */
export const getAvailabilityStatus = (availability: WorldAvailability | undefined): "checking" | "ok" | "fail" => {
  if (!availability) return "checking";
  if (availability.isLoading) return "checking";
  return availability.isAvailable ? "ok" : "fail";
};
