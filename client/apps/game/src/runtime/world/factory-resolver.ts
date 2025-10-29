import { normalizeSelector, nameToPaddedFelt } from "./normalize";
import type { FactoryContractRow } from "./types";

const buildSqlUrl = (baseSqlUrl: string, query: string) => {
  const encoded = encodeURIComponent(query);
  return `${baseSqlUrl}?query=${encoded}`;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Factory SQL failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
};

/**
 * Query the factory for all contracts belonging to the given world name.
 * World name must be encoded to felt-hex (ASCII) left-padded with zeros to 32 bytes.
 */
export const resolveWorldContracts = async (
  factorySqlBaseUrl: string,
  worldName: string,
): Promise<Record<string, string>> => {
  if (!factorySqlBaseUrl) throw new Error("Factory SQL base URL is not configured for this chain");

  const paddedName = nameToPaddedFelt(worldName);
  const query = `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`;
  const url = buildSqlUrl(factorySqlBaseUrl, query);
  const rows = await fetchJson<FactoryContractRow[]>(url);

  const map: Record<string, string> = {};
  for (const row of rows) {
    const key = normalizeSelector(row.contract_selector);
    map[key] = row.contract_address;
  }
  return map;
};

/** Quick availability probe against a Torii base URL */
export const isToriiAvailable = async (toriiBaseUrl: string): Promise<boolean> => {
  try {
    const res = await fetch(`${toriiBaseUrl}/sql`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Resolve the deployed world contract address from the factory indexer.
 * Looks up wf-WorldDeployed by padded world name felt.
 * Returns null if not found.
 */
export const resolveWorldAddressFromFactory = async (
  factorySqlBaseUrl: string,
  worldName: string,
): Promise<string | null> => {
  if (!factorySqlBaseUrl) return null;

  const paddedName = nameToPaddedFelt(worldName);
  const query = `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`;
  const url = buildSqlUrl(factorySqlBaseUrl, query);

  try {
    const rows = await fetchJson<any[]>(url);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as any;
    // prefer explicit address field; keep compatibility with possible schemas
    return (row.address as string) || (row.contract_address as string) || null;
  } catch {
    return null;
  }
};
