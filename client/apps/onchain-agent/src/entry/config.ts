import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Chain } from "../auth/policies.js";

/** Load .env from cwd if it exists (no dependency needed). */
function loadDotenv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Don't override existing env vars
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

interface AgentConfig {
  // World connection
  chain: Chain;
  worldName?: string;
  rpcUrl: string;
  toriiUrl: string;
  worldAddress: string;
  chainId: string;
  // Agent
  modelProvider: string;
  modelId: string;
  tickIntervalMs: number;
  dataDir: string;
  // VRF
  vrfProviderAddress: string;
}

/** Normalize a hex address to 0x + 64 hex chars (zero-padded). */
function normalizeHexAddress(addr: string): string {
  if (!addr) return addr;
  try {
    const n = BigInt(addr);
    return `0x${n.toString(16).padStart(64, "0")}`;
  } catch {
    return addr;
  }
}

const DEFAULT_VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

const DEFAULT_RPC: Record<string, string> = {
  mainnet: "https://api.cartridge.gg/x/starknet/mainnet",
  sepolia: "https://api.cartridge.gg/x/starknet/sepolia",
};

const DEFAULT_CHAIN_ID: Record<string, string> = {
  mainnet: "SN_MAIN",
  sepolia: "SN_SEPOLIA",
};

/**
 * Load config from environment variables.
 *
 * Two modes:
 *   1. WORLD_NAME only — discovers toriiUrl, worldAddress, rpcUrl from the factory
 *   2. TORII_URL + WORLD_ADDRESS — explicit, skips discovery
 *
 * Discovery is async and runs in main() after loadConfig().
 */
export function loadConfig(): AgentConfig {
  loadDotenv();
  const env = process.env;
  const tickMs = Number(env.TICK_INTERVAL_MS);
  const chain = (env.CHAIN as Chain) ?? "mainnet";

  const worldName = env.WORLD_NAME;
  const hasExplicit = env.TORII_URL && env.WORLD_ADDRESS;

  if (!worldName && !hasExplicit) {
    throw new Error(
      "Set WORLD_NAME in .env for auto-discovery, or provide TORII_URL + WORLD_ADDRESS for manual config.",
    );
  }

  // When using WORLD_NAME, these are placeholders — resolved in main() via discoverWorld()
  const toriiUrl = env.TORII_URL ?? "";
  const worldAddress = normalizeHexAddress(env.WORLD_ADDRESS ?? "");

  return {
    chain,
    worldName,
    rpcUrl: env.RPC_URL || DEFAULT_RPC[chain] || DEFAULT_RPC.mainnet,
    toriiUrl,
    worldAddress,
    chainId: env.CHAIN_ID ?? DEFAULT_CHAIN_ID[chain] ?? "SN_MAIN",
    modelProvider: env.MODEL_PROVIDER ?? "anthropic",
    modelId: env.MODEL_ID ?? "claude-sonnet-4-20250514",
    tickIntervalMs: Number.isFinite(tickMs) && tickMs > 0 ? Math.floor(tickMs) : 60_000,
    dataDir: worldAddress
      ? join(homedir(), ".axis", "worlds", worldAddress)
      : join(homedir(), ".axis", "worlds", "_pending"),
    vrfProviderAddress: env.VRF_PROVIDER_ADDRESS ?? DEFAULT_VRF_PROVIDER_ADDRESS,
  };
}
