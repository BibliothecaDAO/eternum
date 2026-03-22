import { getFactorySqlBaseUrl } from "../../../../common/factory/endpoints";
import { resolveRepoPath } from "../shared/repo";
import * as fs from "node:fs";

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
}

interface WorldManifest {
  address?: string;
}

interface ContractManifest {
  address?: string;
  selector?: string;
  tag?: string;
}

interface GameManifestLike {
  world?: WorldManifest;
  contracts?: ContractManifest[];
}

interface PrizeDistributionResolution {
  worldAddress: string | null;
  patchedManifest: GameManifestLike;
  prizeDistributionAddress: string;
}

const WORLD_CONTRACTS_QUERY = (paddedName: string) =>
  `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`;
const WORLD_DEPLOYED_QUERY = (paddedName: string) =>
  `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`;

function buildSqlQueryUrl(baseUrl: string, query: string) {
  return `${baseUrl}?query=${encodeURIComponent(query)}`;
}

function normalizeHex(value: string) {
  const normalizedValue = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  return `0x${normalizedValue.toLowerCase().padStart(64, "0")}`;
}

function isZeroAddress(value?: string | null) {
  if (!value) {
    return true;
  }

  const normalizedValue = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  return normalizedValue.length === 0 || /^0+$/i.test(normalizedValue);
}

function nameToPaddedFelt(name: string) {
  const bytes = new TextEncoder().encode(name);
  let hex = "";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return `0x${hex.padStart(64, "0")}`;
}

async function fetchFactorySqlRows<Row>(
  chain: string,
  query: string,
  cartridgeApiBase: string,
  context: string,
): Promise<Row[]> {
  const sqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);

  if (!sqlBaseUrl) {
    throw new Error(`No factory SQL base URL configured for chain "${chain}"`);
  }

  const response = await fetch(buildSqlQueryUrl(sqlBaseUrl, query));

  if (!response.ok) {
    throw new Error(`${context}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(`${context}: expected array response`);
  }

  return payload as Row[];
}

function loadGameManifest(chain: string): GameManifestLike {
  const manifestPath = resolveRepoPath(`contracts/game/manifest_${chain}.json`);
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as GameManifestLike;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value) as unknown;
      return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
        ? (parsedValue as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeAddressFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  return typeof value === "bigint" ? `0x${value.toString(16)}` : null;
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

async function resolveContractsBySelector(chain: string, gameName: string, cartridgeApiBase: string) {
  const paddedName = nameToPaddedFelt(gameName);
  const rows = await fetchFactorySqlRows<FactoryContractRow>(
    chain,
    WORLD_CONTRACTS_QUERY(paddedName),
    cartridgeApiBase,
    "Failed to fetch world contracts from factory",
  );

  if (rows.length === 0) {
    throw new Error(`No contracts returned from factory for game "${gameName}" on "${chain}"`);
  }

  return rows.reduce<Record<string, string>>((contractsBySelector, row) => {
    if (!row.contract_address || !row.contract_selector) {
      return contractsBySelector;
    }

    contractsBySelector[normalizeHex(row.contract_selector)] = row.contract_address;
    return contractsBySelector;
  }, {});
}

async function resolveWorldAddress(chain: string, gameName: string, cartridgeApiBase: string) {
  const paddedName = nameToPaddedFelt(gameName);
  const rows = await fetchFactorySqlRows<Record<string, unknown>>(
    chain,
    WORLD_DEPLOYED_QUERY(paddedName),
    cartridgeApiBase,
    "Failed to fetch world deployment from factory",
  );

  return rows[0] ? extractWorldAddressFromRow(rows[0]) : null;
}

function patchManifestWithFactoryResolution(
  baseManifest: GameManifestLike,
  worldAddress: string | null,
  contractsBySelector: Record<string, string>,
): GameManifestLike {
  const patchedManifest = JSON.parse(JSON.stringify(baseManifest)) as GameManifestLike;

  if (patchedManifest.world && worldAddress) {
    patchedManifest.world.address = worldAddress;
  }

  if (!Array.isArray(patchedManifest.contracts)) {
    return patchedManifest;
  }

  patchedManifest.contracts = patchedManifest.contracts.map((contract) => {
    if (!contract?.selector) {
      return contract;
    }

    const resolvedAddress = contractsBySelector[normalizeHex(contract.selector)];
    return resolvedAddress ? { ...contract, address: resolvedAddress } : contract;
  });

  return patchedManifest;
}

function resolvePrizeDistributionAddressFromPatchedManifest(patchedManifest: GameManifestLike) {
  const contracts = Array.isArray(patchedManifest.contracts) ? patchedManifest.contracts : [];

  const taggedContract = contracts.find(
    (contract) => typeof contract?.tag === "string" && contract.tag.includes("prize_distribution_systems"),
  );

  if (taggedContract?.address && !isZeroAddress(taggedContract.address)) {
    return taggedContract.address;
  }

  throw new Error('Could not resolve non-zero "prize_distribution_systems" address from patched manifest');
}

export async function resolvePrizeDistributionAddressForFactoryGame(params: {
  chain: string;
  gameName: string;
  cartridgeApiBase: string;
}): Promise<PrizeDistributionResolution> {
  const baseManifest = loadGameManifest(params.chain);
  const contractsBySelector = await resolveContractsBySelector(params.chain, params.gameName, params.cartridgeApiBase);
  const worldAddress = await resolveWorldAddress(params.chain, params.gameName, params.cartridgeApiBase);
  const patchedManifest = patchManifestWithFactoryResolution(baseManifest, worldAddress, contractsBySelector);

  return {
    worldAddress,
    patchedManifest,
    prizeDistributionAddress: resolvePrizeDistributionAddressFromPatchedManifest(patchedManifest),
  };
}
