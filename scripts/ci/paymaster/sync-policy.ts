#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { getFactorySqlBaseUrl } from "../../../common/factory/endpoints.ts";

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
}

interface PaymasterAction {
  contractAddress: string;
  entrypoint: string;
}

interface WorldManifest {
  address?: string;
  entrypoints?: string[];
}

interface ContractManifest {
  address?: string;
  selector?: string;
  systems?: string[];
}

interface GameManifestLike {
  world?: WorldManifest;
  contracts?: ContractManifest[];
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key] = value;
  }
  return out;
}

function usage() {
  console.log(`
Usage:
  bun scripts/ci/paymaster/sync-policy.ts --chain <mainnet|sepolia|slot|slottest|local> --game <world-name> [--paymaster empire] [--dry-run]

Examples:
  bun scripts/ci/paymaster/sync-policy.ts --chain mainnet --game waterbox-batch-cooking
  bun scripts/ci/paymaster/sync-policy.ts --chain slot --game bltz-shark-soil-68 --dry-run
`);
}

const repoRoot = path.resolve(__dirname ?? import.meta.dir, "../../../");

const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);
const normalizeHex = (value: string) => `0x${strip0x(value).toLowerCase().padStart(64, "0")}`;

const nameToPaddedFelt = (name: string): string => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
};

const buildApiUrl = (baseUrl: string, query: string): string => `${baseUrl}?query=${encodeURIComponent(query)}`;

const worldContractsQuery = (paddedName: string) =>
  `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`;
const worldDeployedQuery = (paddedName: string) =>
  `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`;

async function fetchSqlRows<T>(baseUrl: string, query: string, context: string): Promise<T[]> {
  const url = buildApiUrl(baseUrl, query);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${context}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`${context}: expected array response`);
  }
  return json as T[];
}

function loadJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

function isZeroAddress(value?: string | null): boolean {
  if (!value) return true;
  const body = strip0x(value).toLowerCase();
  return body.length === 0 || /^0+$/.test(body);
}

function normalizeAddressFromValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  return null;
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

function extractWorldAddressFromRow(row: Record<string, unknown>): string | null {
  const direct =
    normalizeAddressFromValue(row.address) ??
    normalizeAddressFromValue(row.contract_address) ??
    normalizeAddressFromValue(row.world_address) ??
    normalizeAddressFromValue(row.worldAddress);
  if (direct) return direct;

  const dataRecord = asRecord(row.data);
  if (!dataRecord) return null;

  return (
    normalizeAddressFromValue(dataRecord.address) ??
    normalizeAddressFromValue(dataRecord.contract_address) ??
    normalizeAddressFromValue(dataRecord.world_address) ??
    normalizeAddressFromValue(dataRecord.worldAddress)
  );
}

async function resolveContractsBySelector(
  chain: string,
  worldName: string,
  cartridgeApiBase: string,
): Promise<Record<string, string>> {
  const sqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!sqlBaseUrl) throw new Error(`No factory SQL base URL configured for chain "${chain}"`);

  const padded = nameToPaddedFelt(worldName);
  const rows = await fetchSqlRows<FactoryContractRow>(
    sqlBaseUrl,
    worldContractsQuery(padded),
    "Failed to fetch world contracts from factory",
  );

  if (rows.length === 0) {
    throw new Error(`No contracts returned from factory for game "${worldName}" on chain "${chain}"`);
  }

  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!row.contract_address || !row.contract_selector) continue;
    map[normalizeHex(row.contract_selector)] = row.contract_address;
  }
  return map;
}

async function resolveWorldAddress(chain: string, worldName: string, cartridgeApiBase: string): Promise<string | null> {
  const sqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!sqlBaseUrl) return null;

  const padded = nameToPaddedFelt(worldName);
  const rows = await fetchSqlRows<Record<string, unknown>>(
    sqlBaseUrl,
    worldDeployedQuery(padded),
    "Failed to fetch world deployment from factory",
  );

  if (!rows.length) return null;
  return extractWorldAddressFromRow(rows[0]);
}

function patchManifestWithFactory(
  baseManifest: GameManifestLike,
  worldAddress: string | null,
  contractsBySelector: Record<string, string>,
): GameManifestLike {
  const manifest = JSON.parse(JSON.stringify(baseManifest)) as GameManifestLike;

  if (manifest.world && worldAddress) {
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

function buildPaymasterActions(manifest: GameManifestLike, vrfProviderAddress?: string): PaymasterAction[] {
  const actionsMap = new Map<string, PaymasterAction>();

  const addAction = (contractAddress?: string, entrypoint?: string) => {
    if (!contractAddress || !entrypoint) return;
    const key = `${contractAddress.toLowerCase()}:${entrypoint}`;
    if (!actionsMap.has(key)) {
      actionsMap.set(key, { contractAddress, entrypoint });
    }
  };

  if (manifest.world?.address && Array.isArray(manifest.world.entrypoints)) {
    for (const entrypoint of manifest.world.entrypoints) {
      addAction(manifest.world.address, entrypoint);
    }
  }

  if (Array.isArray(manifest.contracts)) {
    for (const contract of manifest.contracts) {
      if (!contract?.address || !Array.isArray(contract.systems)) continue;
      for (const entrypoint of contract.systems) {
        addAction(contract.address, entrypoint);
      }
    }
  }

  if (vrfProviderAddress && !isZeroAddress(vrfProviderAddress)) {
    addAction(vrfProviderAddress, "request_random");
  }

  return Array.from(actionsMap.values());
}

function resolveVrfProviderAddress(chain: string): string | undefined {
  try {
    const config = loadJsonFile<{ configuration?: { vrf?: { vrfProviderAddress?: string } } }>(
      `config/environments/data/${chain}.json`,
    );
    return config?.configuration?.vrf?.vrfProviderAddress;
  } catch {
    return undefined;
  }
}

function formatOutputFilename(chain: string, gameName: string): string {
  const safeGameName = gameName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `eternum-actions-${chain}-${safeGameName || "world"}.json`;
}

function runSlotPaymasterUpdate(paymasterName: string, filePath: string) {
  const args = ["paymaster", paymasterName, "policy", "add-from-json", "--file", filePath];
  const result = spawnSync("slot", args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`Failed to execute slot CLI: ${result.error.message}`);
  }
  const code = result.status ?? 1;
  if (code !== 0) {
    throw new Error(`slot command failed with exit code ${code}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chain = args.chain || args.network;
  const gameName = args.game || args.world;
  const paymasterName = args.paymaster || "empire";
  const dryRun = args["dry-run"] === "true";
  const cartridgeApiBase = args["cartridge-api-base"] || process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg";

  if (!chain || !gameName) {
    usage();
    throw new Error("Both --chain and --game are required");
  }

  const manifestPath = `contracts/game/manifest_${chain}.json`;
  const baseManifest = loadJsonFile<GameManifestLike>(manifestPath);
  const contractsBySelector = await resolveContractsBySelector(chain, gameName, cartridgeApiBase);
  const worldAddress = await resolveWorldAddress(chain, gameName, cartridgeApiBase);
  const patchedManifest = patchManifestWithFactory(baseManifest, worldAddress, contractsBySelector);
  const vrfProviderAddress = resolveVrfProviderAddress(chain);
  const actions = buildPaymasterActions(patchedManifest, vrfProviderAddress);

  if (!actions.length) {
    throw new Error("No paymaster actions were generated");
  }

  const outputDir = path.resolve(repoRoot, ".context/paymaster");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.resolve(outputDir, formatOutputFilename(chain, gameName));
  fs.writeFileSync(outputFile, JSON.stringify(actions, null, 2));

  console.log(`Generated ${actions.length} actions in ${outputFile}`);
  if (dryRun) {
    console.log(`Dry run: slot paymaster ${paymasterName} policy add-from-json --file ${outputFile}`);
    return;
  }

  runSlotPaymasterUpdate(paymasterName, outputFile);
  console.log(`Updated paymaster "${paymasterName}" policy from ${outputFile}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
