import { env } from "../../../env";

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

/**
 * Where to query a world's data.
 *
 * Cartridge chains give every game its own torii, addressed by game name. The
 * appchain runs ONE torii for every world, so the name is not part of the URL
 * and the shared endpoint from the environment is used instead.
 */
export const resolveWorldToriiBaseUrl = (worldName: string): string => {
  if (env.VITE_PUBLIC_CHAIN === "appchain" && env.VITE_PUBLIC_TORII) {
    return env.VITE_PUBLIC_TORII.replace(/\/+$/, "");
  }

  return `${CARTRIDGE_API_BASE}/x/${worldName}/torii`;
};

/** True when one torii serves several worlds, so queries must be scoped. */
const isSharedWorldTorii = (): boolean => env.VITE_PUBLIC_CHAIN === "appchain";

/**
 * SQL predicate restricting a model table to one world.
 *
 * Torii keys model rows as `internal_id = "<world_address>:<entity_id>"`; there
 * is no world_address column on model tables. Without this, a query against the
 * shared appchain torii matches rows from every world — a player settled in any
 * game would look settled in all of them.
 */
export const worldScopeCondition = (worldAddress: string | null | undefined): string | null => {
  if (!isSharedWorldTorii() || !worldAddress) return null;

  try {
    // torii stores addresses zero-padded to 64 hex chars.
    const padded = `0x${BigInt(worldAddress).toString(16).padStart(64, "0")}`;
    return `internal_id LIKE '${padded}:%'`;
  } catch {
    return null;
  }
};

/** Appends the world scope to a WHERE clause when one applies. */
export const withWorldScope = (condition: string, worldAddress: string | null | undefined): string => {
  const scope = worldScopeCondition(worldAddress);
  return scope ? `${condition} AND ${scope}` : condition;
};

const appchainWorldAddresses = new Map<string, string | null>();

/**
 * Look up a world's address by game name from the factory.
 *
 * Callers that only know the game name still need the address to scope their
 * queries on the shared torii. The factory table is keyed by name, so one
 * lookup (cached for the session — a world's address never changes) is enough.
 */
export const resolveAppchainWorldAddress = async (worldName: string): Promise<string | null> => {
  if (!isSharedWorldTorii() || !worldName) return null;
  const cached = appchainWorldAddresses.get(worldName);
  if (cached !== undefined) return cached;

  try {
    const nameFelt = `0x${Array.from(worldName)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
      .padStart(64, "0")}`;
    const query = `SELECT address FROM "wf-WorldDeployed" WHERE name = '${nameFelt}' LIMIT 1;`;
    const response = await fetch(`${resolveWorldToriiBaseUrl(worldName)}/sql?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const rows = response.ok ? ((await response.json()) as { address?: string }[]) : [];
    const address = rows[0]?.address ?? null;
    appchainWorldAddresses.set(worldName, address);
    return address;
  } catch {
    // Don't cache failures: a transient torii restart shouldn't pin a null.
    return null;
  }
};
