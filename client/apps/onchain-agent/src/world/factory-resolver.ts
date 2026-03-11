import { normalizeSelector, nameToPaddedFelt } from "./normalize";
import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import type { FactoryContractRow } from "./types";

interface WorldDeployment {
  worldAddress: string | null;
  rpcUrl: string | null;
}

export const resolveWorldContracts = async (
  factorySqlBaseUrl: string,
  worldName: string,
): Promise<Record<string, string>> => {
  if (!factorySqlBaseUrl) throw new Error("Factory SQL base URL is not configured for this chain");

  const paddedName = nameToPaddedFelt(worldName);
  const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);
  const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory SQL failed");

  const map: Record<string, string> = {};
  for (const row of rows) {
    const key = normalizeSelector(row.contract_selector);
    map[key] = row.contract_address;
  }
  return map;
};

export const isToriiAvailable = async (toriiBaseUrl: string): Promise<boolean> => {
  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent("SELECT contract_address FROM contracts WHERE contract_type = 'WORLD' LIMIT 1;")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
};

const normalizeAddress = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const extractFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) return value;
  }
  return null;
};

const extractRpcUrlFromRow = (row: Record<string, unknown>): string | null => {
  const direct = extractFirstString(row, ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"]);
  if (direct) return direct;

  const dataRecord = asRecord(row.data);
  if (dataRecord) {
    const nested = extractFirstString(dataRecord, ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"]);
    if (nested) return nested;
  }

  return extractFirstString(row, ["data.rpc_url", "data.rpcUrl", "data.node_url", "data.nodeUrl"]);
};

const extractWorldAddressFromRow = (row: Record<string, unknown>): string | null => {
  const direct =
    normalizeAddress(row.address) ??
    normalizeAddress(row.contract_address) ??
    normalizeAddress(row.world_address) ??
    normalizeAddress(row.worldAddress);
  if (direct) return direct;

  const dataRecord = asRecord(row.data);
  if (dataRecord) {
    return (
      normalizeAddress(dataRecord.address) ??
      normalizeAddress(dataRecord.contract_address) ??
      normalizeAddress(dataRecord.world_address) ??
      normalizeAddress(dataRecord.worldAddress)
    );
  }

  return (
    normalizeAddress(row["data.address"]) ??
    normalizeAddress(row["data.contract_address"]) ??
    normalizeAddress(row["data.world_address"]) ??
    normalizeAddress(row["data.worldAddress"])
  );
};

export const resolveWorldDeploymentFromFactory = async (
  factorySqlBaseUrl: string,
  worldName: string,
): Promise<WorldDeployment | null> => {
  if (!factorySqlBaseUrl) return null;

  const paddedName = nameToPaddedFelt(worldName);
  const query = FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);

  try {
    const rows = await fetchWithErrorHandling<Record<string, unknown>>(url, "Factory SQL failed");
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    return {
      worldAddress: extractWorldAddressFromRow(row),
      rpcUrl: extractRpcUrlFromRow(row),
    };
  } catch {
    return null;
  }
};
