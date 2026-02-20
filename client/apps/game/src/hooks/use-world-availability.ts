/**
 * Cached world availability checks using React Query.
 * This eliminates N+1 request patterns when checking multiple worlds
 * by caching results and sharing them across components.
 */
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// Note: registration_end_at uses start_main_at because registration ends when the main game starts
const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "season_config.dev_mode_on" AS dev_mode_on, "blitz_registration_config.registration_count" AS registration_count, "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token, "blitz_registration_config.fee_amount" AS fee_amount, "blitz_registration_config.registration_start_at" AS registration_start_at, "season_config.start_main_at" AS registration_end_at, "mmr_config.enabled" AS mmr_enabled, "blitz_hypers_settlement_config.max_ring_count" AS max_ring_count FROM "s1_eternum-WorldConfig" LIMIT 1;`;

// Query to get hyperstructure created count (separate table)
const HYPERSTRUCTURE_GLOBALS_QUERY = `SELECT created_count FROM "s1_eternum-HyperstructureGlobals" LIMIT 1;`;

/**
 * Calculate number of hyperstructures left to create based on max ring count and created count.
 * Formula: total = 1 + 6*1 + 6*2 + ... + 6*max_ring_count = 1 + 6*(1+2+...+max_ring_count) = 1 + 6*max_ring_count*(max_ring_count+1)/2
 */
const calculateHyperstructuresLeft = (maxRingCount: number, createdCount: number): number => {
  const total = 1 + 6 * ((maxRingCount * (maxRingCount + 1)) / 2);
  return Math.max(0, total - createdCount);
};

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
  // Number of hyperstructures left to create (for forging)
  numHyperstructuresLeft: number | null;
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
 * Uses `once_registered` field which stays true even after settlement
 * (the `registered` field gets set to 0 after settlement)
 */
const fetchPlayerRegistration = async (toriiBaseUrl: string, playerAddress: string): Promise<boolean | null> => {
  try {
    // Use once_registered - it stays true after settlement, while registered gets set to 0
    const query = `SELECT once_registered FROM "s1_eternum-BlitzRealmPlayerRegister" WHERE player = "${playerAddress}" LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    const [row] = data;
    if (row && row.once_registered != null) {
      return parseMaybeBool(row.once_registered);
    }
    // Query succeeded but no row found — player is not registered
    return false;
  } catch {
    // Silently fail - registration check is best-effort
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
    numHyperstructuresLeft: null,
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

      // Calculate hyperstructures left from max_ring_count
      const maxRingCount = parseMaybeHexToNumber(row.max_ring_count) ?? 0;
      if (maxRingCount > 0) {
        // Fetch created count from HyperstructureGlobals
        try {
          const globalsUrl = `${toriiBaseUrl}/sql?query=${encodeURIComponent(HYPERSTRUCTURE_GLOBALS_QUERY)}`;
          const globalsResponse = await fetch(globalsUrl);
          if (globalsResponse.ok) {
            const [globalsRow] = (await globalsResponse.json()) as Record<string, unknown>[];
            const createdCount = parseMaybeHexToNumber(globalsRow?.created_count) ?? 0;
            meta.numHyperstructuresLeft = calculateHyperstructuresLeft(maxRingCount, createdCount);
          } else {
            // If no globals exist yet, all hyperstructures are available
            meta.numHyperstructuresLeft = calculateHyperstructuresLeft(maxRingCount, 0);
          }
        } catch {
          // If query fails, calculate based on zero created
          meta.numHyperstructuresLeft = calculateHyperstructuresLeft(maxRingCount, 0);
        }
      }
    }

    // Fetch player registration status if address provided
    if (playerAddress) {
      meta.isPlayerRegistered = await fetchPlayerRegistration(toriiBaseUrl, playerAddress);
    }
  } catch {
    // Silently fail - metadata fetch is best-effort
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
 * Auto-refreshes every 30 seconds to catch registration/hyperstructure updates.
 * @param worlds - List of worlds to check
 * @param enabled - Whether to enable the queries
 * @param playerAddress - Optional player address (padded felt) to check registration status
 */
/**
 * Lightweight SQL query to fetch registration count for a world.
 * Used for fast-polling during registration periods to detect new registrations.
 */
const REGISTRATION_COUNT_QUERY = `SELECT "blitz_registration_config.registration_count" AS registration_count, "blitz_hypers_settlement_config.max_ring_count" AS max_ring_count FROM "s1_eternum-WorldConfig" LIMIT 1;`;

const fetchRegistrationSnapshot = async (
  worldName: string,
): Promise<{ registrationCount: number; maxRingCount: number } | null> => {
  try {
    const toriiBaseUrl = buildToriiBaseUrl(worldName);
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(REGISTRATION_COUNT_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (!row) return null;
    return {
      registrationCount: parseMaybeHexToNumber(row.registration_count) ?? 0,
      maxRingCount: parseMaybeHexToNumber(row.max_ring_count) ?? 0,
    };
  } catch {
    return null;
  }
};

export const useWorldsAvailability = (worlds: WorldRef[], enabled = true, playerAddress?: string | null) => {
  const queryClient = useQueryClient();

  const queries = useQueries({
    queries: worlds.map((world) => ({
      // Include playerAddress in query key so it refetches when user connects
      queryKey: ["worldAvailability", getWorldKey(world), playerAddress ?? "anonymous"],
      queryFn: () => checkWorldAvailability(world.name, playerAddress),
      enabled: enabled && !!world.name,
      staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchInterval: 30 * 1000, // Auto-refresh every 30s to catch new registrations/forges
      refetchIntervalInBackground: false, // Only refetch when tab is active
      retry: 1,
    })),
  });

  // Fast-poll registration changes during registration periods.
  // When a new player registers, the contract updates max_ring_count which controls
  // how many hyperstructures can be forged. The main query polls every 30s which is
  // too slow — the forge button appears missing until manual reload.
  // This polls registration_count + max_ring_count every 5s and invalidates the
  // main cache when either changes, giving near-instant forge button appearance.
  const prevSnapshotsRef = useRef<Map<string, { registrationCount: number; maxRingCount: number }>>(new Map());

  useEffect(() => {
    if (!enabled || worlds.length === 0) return;

    const intervalId = setInterval(async () => {
      for (const world of worlds) {
        if (!world.name) continue;
        const snapshot = await fetchRegistrationSnapshot(world.name);
        if (!snapshot) continue;

        const worldKey = getWorldKey(world);
        const prev = prevSnapshotsRef.current.get(worldKey);

        if (
          prev &&
          (prev.registrationCount !== snapshot.registrationCount || prev.maxRingCount !== snapshot.maxRingCount)
        ) {
          // Registration state changed — invalidate the full world availability cache
          queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] });
        }

        prevSnapshotsRef.current.set(worldKey, snapshot);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [enabled, worlds, queryClient]);

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
