/**
 * Cached world availability checks using React Query.
 * This eliminates N+1 request patterns when checking multiple worlds
 * by caching results and sharing them across components.
 */
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { useQueries } from "@tanstack/react-query";

// Note: registration_end_at uses start_main_at because registration ends when the main game starts
const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "season_config.dev_mode_on" AS dev_mode_on, "blitz_registration_config.registration_count" AS registration_count, "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token, "blitz_registration_config.fee_amount" AS fee_amount, "blitz_registration_config.registration_start_at" AS registration_start_at, "season_config.start_main_at" AS registration_end_at, "mmr_config.enabled" AS mmr_enabled FROM "s1_eternum-WorldConfig" LIMIT 1;`;

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

const parseMaybeHexToBigInt = (v: unknown): bigint | null => {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    } catch {
      return null;
    }
  }
  return null;
};

const parseMaybeHexToAddress = (v: unknown): string | null => {
  const bigIntVal = parseMaybeHexToBigInt(v);
  if (bigIntVal == null || bigIntVal === 0n) return null;
  return `0x${bigIntVal.toString(16)}`;
};

export interface WorldConfigMeta {
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  // Blitz registration config
  entryTokenAddress: string | null;
  feeTokenAddress: string | null;
  feeAmount: bigint;
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  // MMR
  mmrEnabled: boolean;
  // Dev mode - allows registration during ongoing games
  devModeOn: boolean;
  // Player registration status (null if not checked or no player)
  isPlayerRegistered: boolean | null;
}

interface WorldRef {
  name: string;
  chain?: string;
}

export const getWorldKey = (world: WorldRef): string => (world.chain ? `${world.chain}:${world.name}` : world.name);

interface WorldAvailability {
  worldKey: string;
  worldName: string;
  chain?: string;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

const parseMaybeBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const trimmed = v.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  return null;
};

/**
 * Fetch player registration status from Torii SQL endpoint.
 */
const fetchPlayerRegistration = async (toriiBaseUrl: string, playerAddress: string): Promise<boolean | null> => {
  try {
    const query = `SELECT registered FROM "s1_eternum-BlitzRealmPlayerRegister" WHERE player = "${playerAddress}" LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    const [row] = data;
    if (row && row.registered != null) {
      return parseMaybeBool(row.registered);
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Fetch world config metadata from Torii SQL endpoint.
 * Optionally fetches player registration status if playerAddress is provided.
 * Cached by React Query.
 */
const fetchWorldConfigMeta = async (toriiBaseUrl: string, playerAddress?: string | null): Promise<WorldConfigMeta> => {
  const meta: WorldConfigMeta = {
    startMainAt: null,
    endAt: null,
    registrationCount: null,
    entryTokenAddress: null,
    feeTokenAddress: null,
    feeAmount: 0n,
    registrationStartAt: null,
    registrationEndAt: null,
    mmrEnabled: false,
    devModeOn: false,
    isPlayerRegistered: null,
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
      // Blitz registration config
      if (row.entry_token_address != null) meta.entryTokenAddress = parseMaybeHexToAddress(row.entry_token_address);
      if (row.fee_token != null) meta.feeTokenAddress = parseMaybeHexToAddress(row.fee_token);
      if (row.fee_amount != null) meta.feeAmount = parseMaybeHexToBigInt(row.fee_amount) ?? 0n;
      if (row.registration_start_at != null)
        meta.registrationStartAt = parseMaybeHexToNumber(row.registration_start_at) ?? null;
      if (row.registration_end_at != null)
        meta.registrationEndAt = parseMaybeHexToNumber(row.registration_end_at) ?? null;
      if (row.mmr_enabled != null) {
        const mmrVal = parseMaybeHexToNumber(row.mmr_enabled);
        meta.mmrEnabled = mmrVal != null && mmrVal !== 0;
      }
      if (row.dev_mode_on != null) {
        const devVal = parseMaybeHexToNumber(row.dev_mode_on);
        meta.devModeOn = devVal != null && devVal !== 0;
      }
    }

    // Fetch player registration status if address provided
    if (playerAddress) {
      meta.isPlayerRegistered = await fetchPlayerRegistration(toriiBaseUrl, playerAddress);
    }
  } catch {
    // ignore fetch errors; caller handles defaults
  }
  return meta;
};

/**
 * Check world availability and fetch metadata in one query.
 * Optionally fetches player registration status if playerAddress is provided.
 * Results are cached for 5 minutes to avoid repeated checks.
 */
const checkWorldAvailability = async (
  worldName: string,
  playerAddress?: string | null,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const toriiBaseUrl = buildToriiBaseUrl(worldName);
  const isAvailable = await isToriiAvailable(toriiBaseUrl);

  if (!isAvailable) {
    return { isAvailable: false, meta: null };
  }

  const meta = await fetchWorldConfigMeta(toriiBaseUrl, playerAddress);
  return { isAvailable: true, meta };
};

/**
 * Hook to check multiple worlds' availability with batched queries.
 * Uses React Query's useQueries for parallel execution with caching.
 * Results are cached for 5 minutes.
 * @param worlds - List of worlds to check
 * @param enabled - Whether to enable the queries
 * @param playerAddress - Optional player address (padded felt) to check registration status
 */
export const useWorldsAvailability = (worlds: WorldRef[], enabled = true, playerAddress?: string | null) => {
  const queries = useQueries({
    queries: worlds.map((world) => ({
      // Include playerAddress in query key so it refetches when user connects
      queryKey: ["worldAvailability", getWorldKey(world), playerAddress ?? "anonymous"],
      queryFn: () => checkWorldAvailability(world.name, playerAddress),
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
