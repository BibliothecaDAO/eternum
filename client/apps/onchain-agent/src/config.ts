import { fileURLToPath } from "node:url";

export interface AgentConfig {
  rpcUrl: string;
  toriiUrl: string;
  worldAddress: string;
  manifestPath: string;
  privateKey: string;
  accountAddress: string;
  tickIntervalMs: number;
  modelProvider: string;
  modelId: string;
  dataDir: string;
}

export function loadConfig(): AgentConfig {
  const env = process.env;
  return {
    rpcUrl: env.RPC_URL ?? "http://localhost:5050",
    toriiUrl: env.TORII_URL ?? "http://localhost:8080",
    worldAddress: env.WORLD_ADDRESS ?? "0x0",
    manifestPath:
      env.MANIFEST_PATH ?? fileURLToPath(new URL("../../../../contracts/game/manifest_local.json", import.meta.url)),
    privateKey: env.PRIVATE_KEY ?? "0x0",
    accountAddress: env.ACCOUNT_ADDRESS ?? "0x0",
    tickIntervalMs: Number(env.TICK_INTERVAL_MS ?? 60000),
    modelProvider: env.MODEL_PROVIDER ?? "anthropic",
    modelId: env.MODEL_ID ?? "claude-sonnet-4-5-20250929",
    dataDir: new URL("../data", import.meta.url).pathname,
  };
}
