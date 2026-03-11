import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Account, RpcProvider } from "starknet";
import { getFactorySqlBaseUrl } from "../../../common/factory/endpoints.ts";

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

interface GrantRoleCall {
  contractAddress: string;
  entrypoint: "grant_role";
  calldata: [string, string];
}

const MINTER_ROLE = "0x032df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const COLLECTIBLE_KEYS = ["Collectibles: Realms: Loot Chest", "Collectibles: Realms: Elite Invite"] as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../");
const isColorEnabled = process.env.NO_COLOR ? false : process.env.FORCE_COLOR !== "0";

function color(code: number, text: string): string {
  return isColorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

const cyan = (text: string) => color(36, text);
const green = (text: string) => color(32, text);
const yellow = (text: string) => color(33, text);
const red = (text: string) => color(31, text);

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
  console.log(
    cyan(`
Usage:
  pnpm dlx tsx scripts/ci/roles/grant-prize-distributor-minter-role.ts --game <world-name> [--chain mainnet] [--dry-run]

Examples:
  pnpm dlx tsx scripts/ci/roles/grant-prize-distributor-minter-role.ts --game waterbox-batch-cooking
  pnpm dlx tsx scripts/ci/roles/grant-prize-distributor-minter-role.ts --chain mainnet --game waterbox-batch-cooking --dry-run
`),
  );
}

const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);
const normalizeHex = (value: string) => `0x${strip0x(value).toLowerCase().padStart(64, "0")}`;

function isZeroAddress(value?: string | null): boolean {
  if (!value) return true;
  const body = strip0x(value).toLowerCase();
  return body.length === 0 || /^0+$/.test(body);
}

function toSafeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nameToPaddedFelt(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
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

  const paddedName = nameToPaddedFelt(worldName);
  const rows = await fetchSqlRows<FactoryContractRow>(
    sqlBaseUrl,
    worldContractsQuery(paddedName),
    "Failed to fetch world contracts from factory",
  );
  if (!rows.length) throw new Error(`No contracts returned from factory for game "${worldName}" on "${chain}"`);

  const contractsBySelector: Record<string, string> = {};
  for (const row of rows) {
    if (!row.contract_address || !row.contract_selector) continue;
    contractsBySelector[normalizeHex(row.contract_selector)] = row.contract_address;
  }
  return contractsBySelector;
}

async function resolveWorldAddress(chain: string, worldName: string, cartridgeApiBase: string): Promise<string | null> {
  const sqlBaseUrl = getFactorySqlBaseUrl(chain, cartridgeApiBase);
  if (!sqlBaseUrl) return null;

  const paddedName = nameToPaddedFelt(worldName);
  const rows = await fetchSqlRows<Record<string, unknown>>(
    sqlBaseUrl,
    worldDeployedQuery(paddedName),
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

function resolvePrizeDistributionAddress(manifest: GameManifestLike): string {
  const contracts = Array.isArray(manifest.contracts) ? manifest.contracts : [];

  const bySuffix = contracts.find(
    (contract) => typeof contract?.tag === "string" && contract.tag.endsWith("-prize_distribution_systems"),
  );
  if (bySuffix?.address && !isZeroAddress(bySuffix.address)) return bySuffix.address;

  const byInclude = contracts.find(
    (contract) => typeof contract?.tag === "string" && contract.tag.includes("prize_distribution_systems"),
  );
  if (byInclude?.address && !isZeroAddress(byInclude.address)) return byInclude.address;

  throw new Error('Could not resolve non-zero "prize_distribution_systems" address from patched manifest');
}

function resolveCommonAddressesPath(chain: string): string {
  const candidates = [`contracts/common/addresses/${chain}.json`, `contracts/addresses/common/${chain}.json`];
  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(repoRoot, candidate))) return candidate;
  }
  throw new Error(`Could not find common addresses file for chain "${chain}"`);
}

function buildGrantRoleCalls(
  collectibleAddressMap: Record<string, unknown>,
  prizeDistributionSystemsAddress: string,
): GrantRoleCall[] {
  const calls: GrantRoleCall[] = [];

  for (const collectibleKey of COLLECTIBLE_KEYS) {
    const maybeAddress = collectibleAddressMap[collectibleKey];
    if (typeof maybeAddress !== "string" || isZeroAddress(maybeAddress)) continue;
    calls.push({
      contractAddress: maybeAddress,
      entrypoint: "grant_role",
      calldata: [MINTER_ROLE, prizeDistributionSystemsAddress],
    });
  }

  return calls;
}

function buildMulticallPayload(calls: GrantRoleCall[]): string {
  return calls.map((call) => `${call.contractAddress} ${call.entrypoint} ${call.calldata.join(" ")}`).join(" / ");
}

async function executeStarknetMulticall(params: {
  chain: string;
  rpcUrl: string;
  accountAddress: string;
  privateKey: string;
  calls: GrantRoleCall[];
}) {
  const chainId =
    params.chain === "mainnet" ? "0x534e5f4d41494e" : params.chain === "sepolia" ? "0x534e5f5345504f4c4941" : undefined;
  const provider = chainId
    ? new RpcProvider({ nodeUrl: params.rpcUrl, chainId })
    : new RpcProvider({ nodeUrl: params.rpcUrl });

  const account = new Account({
    provider,
    address: params.accountAddress,
    signer: params.privateKey,
  });

  console.log(
    cyan(`Submitting starknet.js multicall (${params.calls.length} call${params.calls.length === 1 ? "" : "s"})...`),
  );
  const tx = await account.execute(params.calls);
  console.log(green(`Transaction submitted: ${tx.transaction_hash}`));

  const receipt = await account.waitForTransaction(tx.transaction_hash);
  const success =
    (typeof (receipt as any).isSuccess === "function" && (receipt as any).isSuccess()) ||
    (receipt as any)?.execution_status === "SUCCEEDED";

  if (!success) {
    throw new Error(`starknet.js multicall failed for tx ${tx.transaction_hash}`);
  }

  console.log(green(`Transaction confirmed: ${tx.transaction_hash}`));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chain = args.chain || "mainnet";
  const gameName = args.game || args.world;
  const dryRun = args["dry-run"] === "true";
  const cartridgeApiBase = args["cartridge-api-base"] || process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg";

  if (!gameName) {
    usage();
    throw new Error("--game is required");
  }

  const manifestPath = `contracts/game/manifest_${chain}.json`;
  const baseManifest = loadJsonFile<GameManifestLike>(manifestPath);
  const contractsBySelector = await resolveContractsBySelector(chain, gameName, cartridgeApiBase);
  const worldAddress = await resolveWorldAddress(chain, gameName, cartridgeApiBase);
  const patchedManifest = patchManifestWithFactory(baseManifest, worldAddress, contractsBySelector);
  const prizeDistributionSystemsAddress = resolvePrizeDistributionAddress(patchedManifest);

  const commonAddressesPath = resolveCommonAddressesPath(chain);
  const collectibleAddressMap = loadJsonFile<Record<string, unknown>>(commonAddressesPath);
  const calls = buildGrantRoleCalls(collectibleAddressMap, prizeDistributionSystemsAddress);

  const outputDir = path.resolve(repoRoot, ".context/minter-role", chain, toSafeSlug(gameName) || "world");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "patched_manifest.json"), JSON.stringify(patchedManifest, null, 2));
  fs.writeFileSync(path.join(outputDir, "grant_role_calls.json"), JSON.stringify(calls, null, 2));

  if (!calls.length) {
    fs.writeFileSync(path.join(outputDir, "grant_role_multicall.txt"), "");
    console.log(yellow(`No collectible addresses to update for chain "${chain}". Nothing to execute.`));
    return;
  }

  const payload = buildMulticallPayload(calls);
  fs.writeFileSync(path.join(outputDir, "grant_role_multicall.txt"), payload + "\n");

  console.log(cyan(`Resolved prize_distribution_systems: ${prizeDistributionSystemsAddress}`));
  for (const call of calls) {
    console.log(cyan(`Queued grant_role on ${call.contractAddress} -> ${call.calldata[1]}`));
  }

  if (dryRun) {
    console.log(yellow(`Dry run payload:\n${payload}`));
    return;
  }

  const accountAddress = process.env.CI_MAINNET_ACCOUNT_ADDRESS || args["account-address"] || "";
  const privateKey = process.env.CI_MAINNET_PRIVATE_KEY || args["private-key"] || "";
  const rpcUrl = process.env.CI_MAINNET_RPC_URL || args["rpc-url"] || "https://api.cartridge.gg/x/starknet/mainnet";

  if (!accountAddress || !privateKey) {
    throw new Error("Missing CI_MAINNET_ACCOUNT_ADDRESS/CI_MAINNET_PRIVATE_KEY (or --account-address/--private-key)");
  }

  await executeStarknetMulticall({
    chain,
    rpcUrl,
    accountAddress,
    privateKey,
    calls,
  });

  console.log(green("Minter role multicall executed successfully with starknet.js."));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(red(message));
  process.exit(1);
});
