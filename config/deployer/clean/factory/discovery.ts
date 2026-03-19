import { getFactorySqlBaseUrl } from "../../../../common/factory/endpoints";
import type { GameManifestLike } from "../shared/manifest-types";
import type { FactoryWorldProfile } from "../types";

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
}

interface FactoryLookupQueries {
  contracts: string;
  world: string;
}

interface ManifestContractAddressLookup {
  label: string;
  exactTag?: string;
  suffix?: string;
  includes?: string;
}

const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);
const normalizeHex = (value: string) => `0x${strip0x(value).toLowerCase().padStart(64, "0")}`;

function encodeWorldNameForFactory(worldName: string): string {
  const bytes = new TextEncoder().encode(worldName);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return `0x${hex.padStart(64, "0")}`;
}

function buildFactorySqlUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?query=${encodeURIComponent(query)}`;
}

function buildFactoryLookupQueries(worldName: string): FactoryLookupQueries {
  const paddedName = encodeWorldNameForFactory(worldName);

  return {
    contracts: `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`,
    world: `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`,
  };
}

async function fetchFactorySqlRows<T>(baseUrl: string, query: string, context: string): Promise<T[]> {
  const response = await fetch(buildFactorySqlUrl(baseUrl, query));
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
  if (!value) {
    return null;
  }

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
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }

  return null;
}

function extractWorldAddressFromRow(row: Record<string, unknown>): string | null {
  const directAddress =
    normalizeAddressFromValue(row.address) ??
    normalizeAddressFromValue(row.contract_address) ??
    normalizeAddressFromValue(row.world_address) ??
    normalizeAddressFromValue(row.worldAddress);

  if (directAddress) {
    return directAddress;
  }

  const nestedData = asRecord(row.data);
  if (!nestedData) {
    return null;
  }

  return (
    normalizeAddressFromValue(nestedData.address) ??
    normalizeAddressFromValue(nestedData.contract_address) ??
    normalizeAddressFromValue(nestedData.world_address) ??
    normalizeAddressFromValue(nestedData.worldAddress)
  );
}

function buildContractsBySelector(rows: FactoryContractRow[]): Record<string, string> {
  const contractsBySelector: Record<string, string> = {};

  for (const row of rows) {
    if (!row.contract_address || !row.contract_selector) {
      continue;
    }

    contractsBySelector[normalizeHex(row.contract_selector)] = row.contract_address;
  }

  return contractsBySelector;
}

function buildFactoryWorldProfile(
  contractRows: FactoryContractRow[],
  deployedRows: Record<string, unknown>[],
): FactoryWorldProfile | null {
  if (!contractRows.length || !deployedRows.length) {
    return null;
  }

  const worldAddress = extractWorldAddressFromRow(deployedRows[0]);
  if (!worldAddress) {
    return null;
  }

  return {
    worldAddress,
    contractsBySelector: buildContractsBySelector(contractRows),
  };
}

function requireFactorySqlBaseUrl(chain: string, cartridgeApiBase: string): string {
  const baseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!baseUrl) {
    throw new Error(`No factory SQL base URL configured for chain "${chain}"`);
  }

  return baseUrl;
}

async function fetchFactoryWorldRows(
  chain: string,
  worldName: string,
  cartridgeApiBase: string,
): Promise<[FactoryContractRow[], Record<string, unknown>[]]> {
  const baseUrl = requireFactorySqlBaseUrl(chain, cartridgeApiBase);
  const queries = buildFactoryLookupQueries(worldName);

  return Promise.all([
    fetchFactorySqlRows<FactoryContractRow>(baseUrl, queries.contracts, "Failed to fetch world contracts"),
    fetchFactorySqlRows<Record<string, unknown>>(baseUrl, queries.world, "Failed to fetch world deployment"),
  ]);
}

function cloneManifest(baseManifest: GameManifestLike): GameManifestLike {
  return JSON.parse(JSON.stringify(baseManifest)) as GameManifestLike;
}

function applyWorldAddressToManifest(manifest: GameManifestLike, worldAddress: string): void {
  if (manifest.world) {
    manifest.world.address = worldAddress;
  }
}

function applyContractAddressesToManifest(
  manifest: GameManifestLike,
  contractsBySelector: Record<string, string>,
): void {
  if (!Array.isArray(manifest.contracts)) {
    return;
  }

  manifest.contracts = manifest.contracts.map((contract) => {
    if (!contract?.selector) {
      return contract;
    }

    const mappedAddress = contractsBySelector[normalizeHex(contract.selector)];
    return mappedAddress ? { ...contract, address: mappedAddress } : contract;
  });
}

function getManifestContracts(manifest: GameManifestLike) {
  return Array.isArray(manifest.contracts) ? manifest.contracts : [];
}

function resolveTaggedManifestContract(
  manifest: GameManifestLike,
  matchesTag: (tag: string) => boolean,
): GameManifestLike["contracts"][number] | undefined {
  return getManifestContracts(manifest).find((entry) => {
    const tag = typeof entry?.tag === "string" ? entry.tag : undefined;
    return tag ? matchesTag(tag) : false;
  });
}

function resolveManifestContractAddress(manifest: GameManifestLike, lookup: ManifestContractAddressLookup): string {
  const contract =
    (lookup.exactTag ? resolveTaggedManifestContract(manifest, (tag) => tag === lookup.exactTag) : undefined) ||
    (lookup.suffix ? resolveTaggedManifestContract(manifest, (tag) => tag.endsWith(lookup.suffix)) : undefined) ||
    (lookup.includes ? resolveTaggedManifestContract(manifest, (tag) => tag.includes(lookup.includes)) : undefined);

  if (contract?.address && !isZeroAddress(contract.address)) {
    return contract.address;
  }

  throw new Error(`Could not resolve non-zero "${lookup.label}" address from patched manifest`);
}

export function isZeroAddress(value?: string | null): boolean {
  if (!value) {
    return true;
  }

  return /^0+$/.test(strip0x(value));
}

export async function resolveFactoryWorldProfile(
  chain: string,
  worldName: string,
  cartridgeApiBase: string,
): Promise<FactoryWorldProfile | null> {
  const [contractRows, deployedRows] = await fetchFactoryWorldRows(chain, worldName, cartridgeApiBase);
  return buildFactoryWorldProfile(contractRows, deployedRows);
}

export async function waitForFactoryWorldProfile(options: {
  chain: string;
  worldName: string;
  cartridgeApiBase: string;
  timeoutMs: number;
  pollIntervalMs: number;
  onRetry?: (attempt: number, elapsedMs: number) => void;
}): Promise<FactoryWorldProfile> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + options.timeoutMs;
  let attempts = 0;

  while (Date.now() < deadlineAt) {
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
  const manifest = cloneManifest(baseManifest);
  applyWorldAddressToManifest(manifest, worldAddress);
  applyContractAddressesToManifest(manifest, contractsBySelector);
  return manifest;
}

export function resolvePrizeDistributionSystemsAddress(manifest: GameManifestLike): string {
  return resolveManifestContractAddress(manifest, {
    label: "prize_distribution_systems",
    suffix: "-prize_distribution_systems",
    includes: "prize_distribution_systems",
  });
}

export function resolveRealmSystemsAddress(manifest: GameManifestLike): string {
  return resolveManifestContractAddress(manifest, {
    label: "realm_systems",
    exactTag: "s1_eternum-realm_systems",
    suffix: "-realm_systems",
  });
}

export function resolveRealmInternalSystemsAddress(manifest: GameManifestLike): string {
  return resolveManifestContractAddress(manifest, {
    label: "realm_internal_systems",
    exactTag: "s1_eternum-realm_internal_systems",
    suffix: "-realm_internal_systems",
  });
}

export function resolveVillageSystemsAddress(manifest: GameManifestLike): string {
  return resolveManifestContractAddress(manifest, {
    label: "village_systems",
    exactTag: "s1_eternum-village_systems",
    suffix: "-village_systems",
  });
}
