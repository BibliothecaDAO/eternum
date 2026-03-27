import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { GameType, NetworkType } from "../utils/environment";

const VALID_NETWORKS: NetworkType[] = ["local", "mainnet", "sepolia", "slot", "slottest"];
const DEFAULT_GAME_TYPES: GameType[] = ["eternum", "blitz"];
const VALID_GAME_TYPES: GameType[] = [...DEFAULT_GAME_TYPES];

interface SyncTarget {
  gameTypes: GameType[];
  network: NetworkType;
}

function printSyncUsage(): void {
  console.error("Usage: bun run ./scripts/run-sync.ts <network> [game_type]");
  console.error(`  network must be one of: ${VALID_NETWORKS.join(", ")}`);
  console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
}

function resolveSyncNetwork(argv: string[]): NetworkType {
  const network = argv[2] as NetworkType;

  if (!network || !VALID_NETWORKS.includes(network)) {
    printSyncUsage();
    process.exit(1);
  }

  return network;
}

function resolveSyncGameTypes(argv: string[]): GameType[] {
  if (argv.length > 4) {
    printSyncUsage();
    process.exit(1);
  }

  const gameType = argv[3];

  if (!gameType) {
    return DEFAULT_GAME_TYPES;
  }

  if (!VALID_GAME_TYPES.includes(gameType as GameType)) {
    printSyncUsage();
    process.exit(1);
  }

  return [gameType as GameType];
}

function resolveSyncTarget(argv: string[]): SyncTarget {
  return {
    network: resolveSyncNetwork(argv),
    gameTypes: resolveSyncGameTypes(argv),
  };
}

function resolveConfigDirectory(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function resolveBunExecutable(): string {
  return process.platform === "win32" ? "bun.exe" : "bun";
}

function resolveEnvFilePath(configDirectory: string, network: NetworkType, gameType: GameType): string {
  const envFilePath = path.resolve(configDirectory, `../client/apps/game/.env.${network}.${gameType}`);
  if (fs.existsSync(envFilePath)) {
    return envFilePath;
  }

  if (network === "local") {
    const sampleEnvFilePath = `${envFilePath}.sample`;
    if (fs.existsSync(sampleEnvFilePath)) {
      return sampleEnvFilePath;
    }
  }

  console.error(`Missing environment file for ${gameType} on ${network}: ${envFilePath}`);
  process.exit(1);
}

function runSingleGameSync(configDirectory: string, network: NetworkType, gameType: GameType): void {
  const envFilePath = resolveEnvFilePath(configDirectory, network, gameType);
  const result = spawnSync(
    resolveBunExecutable(),
    [`--env-file=${envFilePath}`, "run", "./sync/index.ts", network, gameType],
    { cwd: configDirectory, stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runConfigSync(argv: string[]): void {
  const configDirectory = resolveConfigDirectory();
  const target = resolveSyncTarget(argv);

  for (const gameType of target.gameTypes) {
    runSingleGameSync(configDirectory, target.network, gameType);
  }
}

runConfigSync(process.argv);
