import path from "node:path";
import { resolveDefaultDataDir, resolveDefaultManifestPath, resolveDefaultSessionBasePath } from "./runtime-paths";
import { deriveChainIdFromRpcUrl } from "./world/normalize";

export type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet";

const CHAIN_ID_FALLBACK: Record<Chain, string> = {
  slot: "0x4b4154414e41",
  slottest: "0x4b4154414e41",
  local: "0x4b4154414e41",
  sepolia: "0x534e5f5345504f4c4941",
  mainnet: "0x534e5f4d41494e",
};

export interface AgentConfig {
  chain: Chain;
  rpcUrl: string;
  toriiUrl: string;
  worldAddress: string;
  manifestPath: string;
  gameName: string;
  chainId: string;
  sessionBasePath: string;
  tickIntervalMs: number;
  loopEnabled: boolean;
  modelProvider: string;
  modelId: string;
  dataDir: string;
}

function parsePositiveIntervalMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function parseChain(value: string | undefined): Chain {
  const valid: Chain[] = ["slot", "slottest", "local", "sepolia", "mainnet"];
  if (value && valid.includes(value as Chain)) {
    return value as Chain;
  }
  return "slot";
}

export function loadConfig(): AgentConfig {
  const env = process.env;
  const chain = parseChain(env.CHAIN);
  const rpcUrl = env.RPC_URL ?? "";
  const chainId = env.CHAIN_ID ?? deriveChainIdFromRpcUrl(rpcUrl) ?? CHAIN_ID_FALLBACK[chain];
  return {
    chain,
    rpcUrl,
    toriiUrl: env.TORII_URL ?? "",
    worldAddress: env.WORLD_ADDRESS ?? "",
    manifestPath: env.MANIFEST_PATH ? path.resolve(env.MANIFEST_PATH) : resolveDefaultManifestPath(env),
    gameName: env.GAME_NAME ?? "eternum",
    chainId,
    sessionBasePath: path.resolve(env.SESSION_BASE_PATH ?? resolveDefaultSessionBasePath(env)),
    tickIntervalMs: parsePositiveIntervalMs(env.TICK_INTERVAL_MS, 60000),
    loopEnabled: parseBoolean(env.LOOP_ENABLED, true),
    modelProvider: env.MODEL_PROVIDER ?? "anthropic",
    modelId: env.MODEL_ID ?? "claude-sonnet-4-5-20250929",
    dataDir: path.resolve(env.DATA_DIR ?? resolveDefaultDataDir(env)),
  };
}
