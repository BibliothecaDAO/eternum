/**
 * Agent configuration: reads environment variables (and an optional `.env`
 * file in the current working directory) and assembles an {@link AgentConfig}.
 */

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

/**
 * All configuration values the agent needs to connect to an Eternum world and
 * operate the tick loop.
 *
 * @property chain              - Target network (`"mainnet"`, `"sepolia"`, `"slot"`, `"slottest"`, or `"local"`).
 *                                Read from `CHAIN` env var; defaults to `"mainnet"`.
 * @property worldName          - Cartridge world slug (e.g. `"xbt5"`). When set, `toriiUrl`
 *                                and `worldAddress` are resolved automatically via `discoverWorld()`.
 * @property rpcUrl             - Starknet RPC endpoint. Falls back to per-chain Cartridge defaults.
 * @property toriiUrl           - Torii indexer URL. Empty string when using `worldName`
 *                                auto-discovery; populated by `discoverWorld()` at startup.
 * @property worldAddress       - 0x-prefixed 64-hex-digit world contract address. Empty string
 *                                when using `worldName` auto-discovery; populated by `discoverWorld()`.
 * @property chainId            - Starknet chain identifier (e.g. `"SN_MAIN"`). Falls back to
 *                                per-chain defaults.
 * @property modelProvider      - LLM provider name (default `"anthropic"`).
 * @property modelId            - Model identifier (default `"claude-sonnet-4-20250514"`).
 * @property tickIntervalMs     - Milliseconds between agent ticks (default 60 000).
 * @property dataDir            - Local directory for soul, tasks, map, and session data.
 *                                Derived automatically: `~/.axis/worlds/<worldAddress>`,
 *                                or `~/.axis/worlds/_pending` before discovery resolves.
 * @property vrfProviderAddress - Starknet address of the VRF provider contract. Has a
 *                                hardcoded default; override via `VRF_PROVIDER_ADDRESS` env var.
 */
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
  slot: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana",
  slottest: "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana",
};

const DEFAULT_CHAIN_ID: Record<string, string> = {
  mainnet: "SN_MAIN",
  sepolia: "SN_SEPOLIA",
  slot: "WP_ETERNUM_BLITZ_SLOT_4",
  slottest: "WP_ETERNUM_BLITZ_SLOT_TEST",
};

/**
 * Load the agent configuration from environment variables (and `.env` if present).
 *
 * Supports two modes:
 * 1. `WORLD_NAME` only — `toriiUrl` and `worldAddress` are left empty and
 *    resolved later via `discoverWorld()` in `main()`.
 * 2. `TORII_URL` + `WORLD_ADDRESS` — explicit values, skips discovery.
 *
 * @returns An {@link AgentConfig} with all fields set; in `WORLD_NAME`-only mode,
 *          `toriiUrl` and `worldAddress` are empty and resolved later by `discoverWorld()`.
 * @throws If neither `WORLD_NAME` nor the `TORII_URL`/`WORLD_ADDRESS` pair is set.
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
