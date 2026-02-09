import path from "node:path";
import { resolveDefaultDataDir, resolveDefaultManifestPath, resolveDefaultSessionBasePath } from "./runtime-paths";

export interface AgentConfig {
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

export function loadConfig(): AgentConfig {
  const env = process.env;
  return {
    rpcUrl: env.RPC_URL ?? "http://localhost:5050",
    toriiUrl: env.TORII_URL ?? "http://localhost:8080",
    worldAddress: env.WORLD_ADDRESS ?? "0x0",
    manifestPath: path.resolve(env.MANIFEST_PATH ?? resolveDefaultManifestPath(env)),
    gameName: env.GAME_NAME ?? "eternum",
    chainId: env.CHAIN_ID ?? "0x534e5f5345504f4c4941",
    sessionBasePath: path.resolve(env.SESSION_BASE_PATH ?? resolveDefaultSessionBasePath(env)),
    tickIntervalMs: parsePositiveIntervalMs(env.TICK_INTERVAL_MS, 60000),
    loopEnabled: parseBoolean(env.LOOP_ENABLED, true),
    modelProvider: env.MODEL_PROVIDER ?? "anthropic",
    modelId: env.MODEL_ID ?? "claude-sonnet-4-5-20250929",
    dataDir: path.resolve(env.DATA_DIR ?? resolveDefaultDataDir(env)),
  };
}
