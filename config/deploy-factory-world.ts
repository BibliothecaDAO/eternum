#!/usr/bin/env bun
/**
 * deploy-factory-world.ts
 *
 * Configures a factory-deployed game world on slot or mainnet.
 * Uses the same manifest-patching approach as scripts/ci/factory/config-calldata.ts:
 * - Loads base manifest_<chain>.json
 * - Patches world address + all contract addresses from factory Torii (by selector)
 * - Passes patched manifest object directly to EternumProvider (no module cache issues)
 *
 * Usage (from config/ directory):
 *   SKIP_CONFIRMATION=true CONFIG_BATCH=1 bun --env-file=../client/apps/game/.env.slot run deploy-factory-world.ts <world-name> [options]
 *
 * Options:
 *   --start-at=<unix>       Game start timestamp (REQUIRED — fetch current time first!)
 *   --duration=<hours>      Game duration in hours (default: 72)
 *   --fee=<amount>          Entry fee override
 *   --dev                   Dev mode (default for slot)
 *   --no-dev                Production mode
 *   --mmr                   Enable MMR
 *   --immunity-ticks=<n>    Override immunity ticks (0 for Blitz)
 *   --chain=<chain>         slot|mainnet (default: slot, or from CHAIN env)
 */

import * as fs from "fs";
import * as path from "path";
import { EternumProvider } from "../packages/provider/dist/index.js";
import { getFactorySqlBaseUrl } from "../common/factory/endpoints.ts";
import { withBatching } from "./deployer/tx-batcher";
import { nodeReadConfig } from "./deployer/config";
import { logNetwork, saveConfigJsonFromConfigTsFile, type NetworkType, type GameType } from "./utils/environment";
import { type Chain } from "./utils/utils";
import { Account } from "starknet";

// ── Helpers ───────────────────────────────────────────────────────────────

const strip0x = (v: string): string => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);
const normalizeHex = (v: string): string => `0x${strip0x(v).toLowerCase().padStart(64, "0")}`;
const nameToPaddedFelt = (name: string): string => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
};

// ── Parse args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const worldName = args.find((a) => !a.startsWith("--"));
if (!worldName) {
  console.error("Usage: bun run deploy-factory-world.ts <world-name> [options]");
  process.exit(1);
}

function getArg(name: string): string | undefined {
  const a = args.find((a) => a.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const chain = (getArg("chain") || process.env.CHAIN || "slot") as Chain;
const gameType = (getArg("game-type") || process.env.GAME_TYPE || "blitz") as GameType;
const startAt = getArg("start-at") ? parseInt(getArg("start-at")!) : 0;
const durationHours = getArg("duration") ? parseInt(getArg("duration")!) : 72;
const feeOverride = getArg("fee");
const devMode = hasFlag("dev") || !hasFlag("no-dev");
const mmr = hasFlag("mmr");
const immunityTicks = getArg("immunity-ticks") !== undefined ? parseInt(getArg("immunity-ticks")!) : undefined;

if (!startAt) {
  console.error("❌ --start-at is required. Run `date +%s` to get current time first!");
  process.exit(1);
}

// ── Env ───────────────────────────────────────────────────────────────────

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

if (!VITE_PUBLIC_MASTER_ADDRESS || !VITE_PUBLIC_MASTER_PRIVATE_KEY || !VITE_PUBLIC_NODE_URL) {
  console.error("❌ Missing env vars. Run via: bun --env-file=../client/apps/game/.env.slot run deploy-factory-world.ts ...");
  process.exit(1);
}

// ── Resolve addresses from factory Torii ─────────────────────────────────

const sqlBaseUrl = getFactorySqlBaseUrl(chain);
const paddedName = nameToPaddedFelt(worldName);

console.log(`\n🔍 Resolving world "${worldName}" from factory Torii (${chain})...`);

// World address
let worldAddress: string | null = null;
for (let i = 0; i < 12; i++) {
  try {
    const url = `${sqlBaseUrl}?query=${encodeURIComponent(`SELECT address FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`)}`;
    const res = await fetch(url);
    const rows: any[] = await res.json();
    if (rows?.[0]?.address) { worldAddress = rows[0].address; break; }
  } catch {}
  if (i < 11) { console.log(`  Retrying in 10s... (${i+1}/12)`); await new Promise(r => setTimeout(r, 10000)); }
}
if (!worldAddress) { console.error(`❌ World "${worldName}" not found in factory Torii`); process.exit(1); }
console.log(`✅ World: ${worldAddress}`);

// Contract addresses by selector
const contractUrl = `${sqlBaseUrl}?query=${encodeURIComponent(`SELECT contract_address, contract_selector FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`)}`;
const contractRows: any[] = await (await fetch(contractUrl)).json();
const selectorMap: Record<string, string> = {};
for (const r of contractRows) {
  if (r.contract_selector && r.contract_address) {
    selectorMap[normalizeHex(r.contract_selector)] = r.contract_address;
  }
}
console.log(`📦 Found ${contractRows.length} contracts`);

// ── Patch manifest ────────────────────────────────────────────────────────

const manifestPath = path.resolve(__dirname ?? import.meta.dir, `../contracts/game/manifest_${chain}.json`);
const baseManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifest = JSON.parse(JSON.stringify(baseManifest)); // deep clone

manifest.world.address = worldAddress;
let patched = 0;
if (Array.isArray(manifest.contracts)) {
  manifest.contracts = manifest.contracts.map((c: any) => {
    if (!c?.selector) return c;
    const addr = selectorMap[normalizeHex(c.selector)];
    if (addr) { patched++; return { ...c, address: addr }; }
    return c;
  });
}
console.log(`📝 Manifest patched: world=${worldAddress}, ${patched}/${manifest.contracts?.length ?? 0} contracts`);

// ── Load and override configuration ──────────────────────────────────────

await saveConfigJsonFromConfigTsFile(chain as NetworkType, gameType);
const configuration = await nodeReadConfig(chain, gameType);

const registrationStartAt = startAt - 3600;
if (startAt && configuration.season) {
  configuration.season.startMainAt = startAt;
  configuration.season.startSettlingAt = registrationStartAt;
  configuration.season.durationSeconds = durationHours * 3600;
}
if (configuration.dev?.mode) configuration.dev.mode.on = devMode;
if (feeOverride && configuration.blitz?.registration) configuration.blitz.registration.fee_amount = feeOverride;
if (immunityTicks !== undefined && configuration.battle) {
  configuration.battle.regular_immunity_ticks = immunityTicks;
  configuration.battle.village_immunity_ticks = immunityTicks;
}
if (configuration.mmr) configuration.mmr.enabled = mmr;

// Zero out slot collectibles (not deployed on slot chain)
if (chain === "slot" && configuration.blitz?.registration) {
  configuration.blitz.registration.collectibles_lootchest_address = "0x0";
  configuration.blitz.registration.collectibles_elitenft_address = "0x0";
}

console.log(`\n⚙️  Config:
  chain:           ${chain}
  world:           ${worldAddress}
  start_main_at:   ${new Date(startAt * 1000).toUTCString()}
  end_at:          ${new Date((startAt + durationHours * 3600) * 1000).toUTCString()}
  duration:        ${durationHours}h
  dev_mode:        ${devMode}
  fee:             ${feeOverride ?? "default"}
  mmr:             ${mmr}
  immunity_ticks:  ${immunityTicks ?? "default"}
`);

// ── Run config ────────────────────────────────────────────────────────────

// Use patched manifest object directly — avoids module cache issues
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const account = new Account({
  provider: provider.provider,
  address: VITE_PUBLIC_MASTER_ADDRESS!,
  signer: VITE_PUBLIC_MASTER_PRIVATE_KEY!,
});

logNetwork(chain as NetworkType);

const { GameConfigDeployer } = await import("./deployer/config");
const config = new GameConfigDeployer(configuration, chain as NetworkType);

const BATCH = process.env.CONFIG_BATCH === "1" || process.env.CONFIG_BATCH === "true";
if (BATCH) {
  config.skipSleeps = true;
  const flushReceipt = await withBatching(
    provider,
    account,
    async () => { await config.setupAll(account, provider); },
    { label: `config-${worldName}` },
  );
  const txHash = (flushReceipt as any)?.transaction_hash ?? "<unknown>";
  console.log(`\n✅ Configuration TX: ${txHash}`);
} else {
  await config.setupAll(account, provider);
  console.log(`\n✅ Game '${worldName}' configured!`);
}
