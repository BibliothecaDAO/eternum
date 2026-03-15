import { getFactorySqlBaseUrl } from "../../../common/factory/endpoints";
import type { FactoryWorldProfile } from "./types";

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
}

interface WorldManifestLike {
  address?: string;
}

interface ContractManifestLike {
  address?: string;
  selector?: string;
  tag?: string;
}

interface GameManifestLike {
  world?: WorldManifestLike;
  contracts?: ContractManifestLike[];
}

const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);
const normalizeHex = (value: string) => `0x${strip0x(value).toLowerCase().padStart(64, "0")}`;

function nameToPaddedFelt(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `0x${hex.padStart(64, "0")}`;
}

function buildApiUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?query=${encodeURIComponent(query)}`;
}

const worldContractsQuery = (paddedName: string) =>
  `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`;
const worldDeployedQuery = (paddedName: string) =>
  `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`;

async function fetchSqlRows<T>(baseUrl: string, query: string, context: string): Promise<T[]> {
  const response = await fetch(buildApiUrl(baseUrl, query));
  if (!response.ok) {
    throw new Error(`${context}: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error(`${context}: expected array response`);
  }

  return json as T[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
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
}

function normalizeAddressFromValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  return null;
}

function extractWorldAddressFromRow(row: Record<string, unknown>): string | null {
  const direct =
    normalizeAddressFromValue(row.address) ??
    normalizeAddressFromValue(row.contract_address) ??
    normalizeAddressFromValue(row.world_address) ??
    normalizeAddressFromValue(row.worldAddress);

  if (direct) {
    return direct;
  }

  const dataRecord = asRecord(row.data);
  if (!dataRecord) {
    return null;
  }

  return (
    normalizeAddressFromValue(dataRecord.address) ??
    normalizeAddressFromValue(dataRecord.contract_address) ??
    normalizeAddressFromValue(dataRecord.world_address) ??
    normalizeAddressFromValue(dataRecord.worldAddress)
  );
}

export function isZeroAddress(value?: string | null): boolean {
  if (!value) return true;
  return /^0+$/.test(strip0x(value));
}

export async function resolveFactoryWorldProfile(
  chain: string,
  worldName: string,
  cartridgeApiBase: string,
): Promise<FactoryWorldProfile | null> {
  const baseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!baseUrl) {
    throw new Error(`No factory SQL base URL configured for chain "${chain}"`);
  }

  const paddedName = nameToPaddedFelt(worldName);
  const [contractRows, deployedRows] = await Promise.all([
    fetchSqlRows<FactoryContractRow>(baseUrl, worldContractsQuery(paddedName), "Failed to fetch world contracts"),
    fetchSqlRows<Record<string, unknown>>(baseUrl, worldDeployedQuery(paddedName), "Failed to fetch world deployment"),
  ]);

  if (!contractRows.length || !deployedRows.length) {
    return null;
  }

  const contractsBySelector: Record<string, string> = {};
  for (const row of contractRows) {
    if (!row.contract_address || !row.contract_selector) continue;
    contractsBySelector[normalizeHex(row.contract_selector)] = row.contract_address;
  }

  const worldAddress = extractWorldAddressFromRow(deployedRows[0]);
  if (!worldAddress) {
    return null;
  }

  return {
    worldAddress,
    contractsBySelector,
  };
}

export async function waitForFactoryWorldProfile(options: {
  chain: string;
  worldName: string;
  cartridgeApiBase: string;
  timeoutMs: number;
  pollIntervalMs: number;
  onRetry?: (attempt: number, elapsedMs: number) => void;
}): Promise<FactoryWorldProfile> {
  const deadline = Date.now() + options.timeoutMs;
  const startedAt = Date.now();
  let attempts = 0;

  while (Date.now() < deadline) {
    const profile = await resolveFactoryWorldProfile(options.chain, options.worldName, options.cartridgeApiBase);
    if (profile) {
      return profile;
    }

    attempts += 1;
    options.onRetry?.(attempts, Date.now() - startedAt);
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for "${options.worldName}" to appear in factory SQL on "${options.chain}" after ${options.timeoutMs}ms`,
  );
}

export function patchManifestWithFactory(
  baseManifest: GameManifestLike,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): GameManifestLike {
  const manifest = JSON.parse(JSON.stringify(baseManifest)) as GameManifestLike;

  if (manifest.world) {
    manifest.world.address = worldAddress;
  }

  if (Array.isArray(manifest.contracts)) {
    manifest.contracts = manifest.contracts.map((contract) => {
      if (!contract?.selector) return contract;
      const mappedAddress = contractsBySelector[normalizeHex(contract.selector)];
      return mappedAddress ? { ...contract, address: mappedAddress } : contract;
    });
  }

  return manifest;
}

export function resolvePrizeDistributionSystemsAddress(manifest: GameManifestLike): string {
  const contracts = Array.isArray(manifest.contracts) ? manifest.contracts : [];

  const bySuffix = contracts.find(
    (contract) => typeof contract?.tag === "string" && contract.tag.endsWith("-prize_distribution_systems"),
  );
  if (bySuffix?.address && !isZeroAddress(bySuffix.address)) {
    return bySuffix.address;
  }

  const byInclude = contracts.find(
    (contract) => typeof contract?.tag === "string" && contract.tag.includes("prize_distribution_systems"),
  );
  if (byInclude?.address && !isZeroAddress(byInclude.address)) {
    return byInclude.address;
  }

  throw new Error('Could not resolve non-zero "prize_distribution_systems" address from patched manifest');
}
