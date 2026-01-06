import { shortString } from "starknet";
import type { Chain, FactoryWorld, WorldConfigMeta, WorldProfile } from "../types";
import { getFactorySqlBaseUrl, buildToriiBaseUrl, getCartridgeApiBase, getRpcUrlForChain } from "./chain-utils";

const FACTORY_QUERY = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;
const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "blitz_registration_config.registration_count" AS registration_count FROM "s1_eternum-WorldConfig" LIMIT 1;`;
const WORLD_CONTRACTS_QUERY = (name: string) =>
  `SELECT contract_address, contract_selector FROM [wf-ContractDeployed] WHERE "world_name" = '${name}'`;
const WORLD_DEPLOYMENT_QUERY = (name: string) =>
  `SELECT "data.world_address" AS world_address FROM [wf-WorldDeployed] WHERE name = '${name}' LIMIT 1;`;
const WORLD_ADDRESS_QUERY = `SELECT world_address FROM worlds LIMIT 1;`;

/**
 * Decode a padded felt ASCII hex string to a human-readable string
 */
export function decodePaddedFeltAscii(hex: string): string {
  try {
    if (!hex) return "";
    const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (h === "0") return "";
    try {
      const asDec = BigInt("0x" + h).toString();
      const decoded = shortString.decodeShortString(asDec);
      if (decoded && decoded.trim().length > 0) return decoded;
    } catch {
      // ignore and fallback to manual decode
    }
    let i = 0;
    while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;
    let out = "";
    for (; i + 1 < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (byte === 0) continue;
      out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
}

/**
 * Extract the name felt from a factory query row
 */
function extractNameFelt(row: Record<string, unknown>): string | null {
  const direct = row.name ?? row["data.name"];
  if (typeof direct === "string") return direct;

  const data = row.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).name;
    if (typeof nested === "string") return nested;
  }

  return null;
}

/**
 * Fetch all factory worlds from a given chain
 */
export async function fetchFactoryWorlds(chain: Chain, cartridgeApiBase?: string): Promise<FactoryWorld[]> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!factorySqlBaseUrl) return [];

  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(FACTORY_QUERY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Factory query failed for ${chain}: ${res.status} ${res.statusText}`);

  const rows = (await res.json()) as Record<string, unknown>[];
  const names: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const feltHex = extractNameFelt(row);
    if (!feltHex) continue;
    const decoded = decodePaddedFeltAscii(feltHex);
    if (!decoded || seen.has(decoded)) continue;
    seen.add(decoded);
    names.push(decoded);
  }

  return names.map((name) => ({ name, chain }));
}

/**
 * Parse a value that might be hex or decimal to a number
 */
function parseMaybeHexToNumber(v: unknown): number | null {
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
}

/**
 * Fetch world config metadata from Torii SQL endpoint
 */
export async function fetchWorldConfigMeta(worldName: string, cartridgeApiBase?: string): Promise<WorldConfigMeta> {
  const toriiBaseUrl = buildToriiBaseUrl(worldName, cartridgeApiBase);
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
}

/**
 * Quick availability probe against a Torii base URL
 */
export async function isToriiAvailable(toriiBaseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${toriiBaseUrl}/sql`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check world availability and fetch metadata
 */
export async function checkWorldAvailability(
  worldName: string,
  cartridgeApiBase?: string,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> {
  const toriiBaseUrl = buildToriiBaseUrl(worldName, cartridgeApiBase);
  const isAvailable = await isToriiAvailable(toriiBaseUrl);

  if (!isAvailable) {
    return { isAvailable: false, meta: null };
  }

  const meta = await fetchWorldConfigMeta(worldName, cartridgeApiBase);
  return { isAvailable: true, meta };
}

/**
 * Fetch contract addresses from the factory for a specific world
 */
export async function fetchWorldContracts(
  chain: Chain,
  worldName: string,
  cartridgeApiBase?: string,
): Promise<Record<string, string>> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!factorySqlBaseUrl) return {};

  try {
    const query = WORLD_CONTRACTS_QUERY(worldName);
    const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return {};

    const rows = (await res.json()) as Array<{ contract_address?: string; contract_selector?: string }>;
    const contracts: Record<string, string> = {};

    for (const row of rows) {
      if (row.contract_selector && row.contract_address) {
        contracts[row.contract_selector] = row.contract_address;
      }
    }

    return contracts;
  } catch {
    return {};
  }
}

/**
 * Fetch world address from factory deployment table
 */
async function fetchWorldAddressFromFactory(
  chain: Chain,
  worldName: string,
  cartridgeApiBase?: string,
): Promise<string | null> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!factorySqlBaseUrl) return null;

  try {
    const query = WORLD_DEPLOYMENT_QUERY(worldName);
    const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const rows = (await res.json()) as Array<{ world_address?: string }>;
    if (rows.length > 0 && rows[0].world_address) {
      return normalizeAddress(rows[0].world_address);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch world address from the world's own Torii
 */
async function fetchWorldAddressFromTorii(toriiBaseUrl: string): Promise<string | null> {
  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_ADDRESS_QUERY)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const rows = (await res.json()) as Array<{ world_address?: string }>;
    if (rows.length > 0 && rows[0].world_address) {
      return normalizeAddress(rows[0].world_address);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize an address value to a hex string
 */
function normalizeAddress(addr: unknown): string | null {
  if (addr == null) return null;
  if (typeof addr === "string") {
    // Already a string, ensure it has 0x prefix
    if (addr.startsWith("0x") || addr.startsWith("0X")) return addr;
    return "0x" + addr;
  }
  if (typeof addr === "bigint") return "0x" + addr.toString(16);
  return null;
}

/**
 * Build a complete WorldProfile by querying the factory and the target world's Torii
 */
export async function buildWorldProfile(chain: Chain, worldName: string, cartridgeApiBase?: string): Promise<WorldProfile> {
  const base = cartridgeApiBase || getCartridgeApiBase();
  const toriiBaseUrl = buildToriiBaseUrl(worldName, base);

  // 1) Resolve contract selectors -> addresses from the factory
  const contractsBySelector = await fetchWorldContracts(chain, worldName, base);

  // 2) Resolve world address - try Torii first, then factory fallback
  let worldAddress = await fetchWorldAddressFromTorii(toriiBaseUrl);
  if (!worldAddress) {
    worldAddress = await fetchWorldAddressFromFactory(chain, worldName, base);
  }
  // Default to 0x0 if not found
  if (!worldAddress) worldAddress = "0x0";

  // 3) Get RPC URL for this chain
  const rpcUrl = getRpcUrlForChain(chain, worldName, base);

  const profile: WorldProfile = {
    name: worldName,
    chain,
    toriiBaseUrl,
    rpcUrl,
    worldAddress,
    contractsBySelector,
    fetchedAt: Date.now(),
  };

  return profile;
}
