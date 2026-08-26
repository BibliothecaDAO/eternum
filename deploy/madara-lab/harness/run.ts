#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger, RpcProvider } from "starknet";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import { createHarnessAccounts } from "./account-factory";
import { prepareHarnessBots, runWorkload, type HarnessSystemAddresses, type TrackedTransaction } from "./driver";
import { collectHarnessEvidenceBeforeRun, finishHarnessEvidence, writeHarnessReport } from "./report";

interface HarnessCliOptions {
  bots: number;
  gameId?: number;
  gameName?: string;
  games: number;
  intervalSeconds: number;
  minutes: number;
  rpcUrl: string;
  setupConcurrency: number;
  toriiSqlUrl: string;
}

interface GameplayContractsArtifact {
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
  rpcUrl?: string;
}

interface WorldManifest {
  contracts: Array<{ address: string; tag: string }>;
}

interface HarnessGame {
  gameId: number;
  gameName: string;
}

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const LAB_DIRECTORY = path.resolve(import.meta.dir, "..");
const DEFAULT_RPC_URL = "http://127.0.0.1:5050/rpc/v0_9_0";
const DEFAULT_TORII_SQL_URL = "http://127.0.0.1:8090/sql";
const MADARA_ADMIN_ADDRESS = "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d";
const MADARA_ADMIN_PRIVATE_KEY = "0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07";

logger.setLogLevel("FATAL");

export function parseHarnessArgs(args: string[]): HarnessCliOptions {
  const values = parseFlags(args);
  if (values.help === "true") {
    printUsage();
    process.exit(0);
  }

  const bots = positiveInteger(values.bots ?? "96", "bots");
  const minutes = positiveNumber(values.minutes ?? "10", "minutes");
  const intervalSeconds = positiveNumber(values["interval-seconds"] ?? "15", "interval-seconds");
  const setupConcurrency = positiveInteger(values["setup-concurrency"] ?? "6", "setup-concurrency");
  const gameId = values["game-id"] === undefined ? undefined : positiveInteger(values["game-id"], "game-id");
  const games = positiveInteger(values.games ?? "1", "games");

  if (bots > 96) throw new Error(`The Madara Blitz preset supports at most 96 bots, received ${bots}`);
  if (gameId !== undefined && games !== 1) throw new Error("--game-id can only be used with --games 1");
  if (gameId !== undefined && !values["game-name"]) {
    values["game-name"] = `game-${gameId}`;
  }

  return {
    bots,
    gameId,
    gameName: values["game-name"],
    games,
    intervalSeconds,
    minutes,
    rpcUrl: values["rpc-url"] ?? process.env.RPC_URL ?? DEFAULT_RPC_URL,
    setupConcurrency,
    toriiSqlUrl: values["torii-sql-url"] ?? process.env.TORII_SQL_URL ?? DEFAULT_TORII_SQL_URL,
  };
}

async function main(): Promise<void> {
  const options = parseHarnessArgs(process.argv.slice(2));
  process.env.TORII_SQL_URL = options.toriiSqlUrl;

  const provider = new RpcProvider({ nodeUrl: options.rpcUrl });
  const [chainId, gameplayContracts, manifest] = await Promise.all([
    provider.getChainId(),
    readJson<GameplayContractsArtifact>(path.join(LAB_DIRECTORY, ".lab/gameplay-contracts.json")),
    readJson<WorldManifest>(path.join(REPOSITORY_ROOT, "contracts/game/manifest_madara.json")),
  ]);
  const systems = resolveSystemAddresses(manifest);
  const games = await resolveHarnessGames(options);
  const setupTransactions: TrackedTransaction[] = [];
  const gameRuns: Array<{
    accounts: Awaited<ReturnType<typeof createHarnessAccounts>>;
    bots: Awaited<ReturnType<typeof prepareHarnessBots>>;
    game: HarnessGame;
  }> = [];

  for (const [gameIndex, game] of games.entries()) {
    console.log(`Deploying ${options.bots} guest gameplay accounts for game ${game.gameId} (${game.gameName})`);
    const accounts = await createHarnessAccounts({
      authority: gameplayContracts.bindingAuthorityAddress,
      botIdOffset: gameIndex * options.bots,
      classHash: gameplayContracts.playerAccountClassHash,
      concurrency: options.setupConcurrency,
      count: options.bots,
      gameId: game.gameId,
      provider,
    });

    console.log(`Settling, provisioning, and creating three explorers per bot for game ${game.gameId}`);
    const bots = await prepareHarnessBots({
      accounts,
      gameId: game.gameId,
      provider,
      setupConcurrency: options.setupConcurrency,
      setupTransactions,
      systems,
      toriiSqlUrl: options.toriiSqlUrl,
    });
    gameRuns.push({ accounts, bots, game });
  }

  const evidenceBefore = await collectHarnessEvidenceBeforeRun();
  console.log("Waiting for all explorers to reach full stamina, then starting the measured workload");
  const workload = await runWorkload({
    bots: gameRuns.flatMap(({ bots }) => bots),
    intervalSeconds: options.intervalSeconds,
    minutes: options.minutes,
    onTick: (completed, total) => {
      if (completed === 1 || completed === total || completed % 5 === 0) {
        console.log(`Scheduled workload tick ${completed}/${total}`);
      }
    },
    provider,
    systems,
    toriiSqlUrl: options.toriiSqlUrl,
  });

  const evidence = await finishHarnessEvidence(evidenceBefore, workload.startedAt, workload.endedAt);
  const minimumCompletedActions = resolveMinimumCompletedActions(options, workload.plannedActions);
  const report = await writeHarnessReport({
    accounts: gameRuns.flatMap(({ accounts }) => accounts),
    botCount: options.bots * options.games,
    chainId,
    evidence,
    games: games.map((game) => ({ ...game, botCount: options.bots })),
    intervalSeconds: options.intervalSeconds,
    minimumCompletedActions,
    minutes: options.minutes,
    rpcUrl: options.rpcUrl,
    setupTransactions,
    toriiSqlUrl: options.toriiSqlUrl,
    workload,
  });

  console.log(`${report.passed ? "PASS" : "FAIL"}: ${report.path}`);
  if (!report.passed) process.exitCode = 1;
}

async function resolveHarnessGames(options: HarnessCliOptions): Promise<HarnessGame[]> {
  if (options.gameId !== undefined) {
    return [{ gameId: options.gameId, gameName: options.gameName! }];
  }

  const baseName = options.gameName ?? `lab-${Date.now().toString(36)}`;
  const games: HarnessGame[] = [];
  for (let index = 0; index < options.games; index += 1) {
    const gameName = options.games === 1 ? baseName : `${baseName}-g${index + 1}`;
    const summary = await launchGame({
      accountAddress: process.env.DOJO_ACCOUNT_ADDRESS ?? MADARA_ADMIN_ADDRESS,
      devModeOn: true,
      durationSeconds: Math.ceil(options.minutes * 60) + 3_600,
      environmentId: "madara.blitz",
      gameName,
      privateKey: process.env.DOJO_PRIVATE_KEY ?? MADARA_ADMIN_PRIVATE_KEY,
      rpcUrl: options.rpcUrl,
      startTime: Math.floor(Date.now() / 1_000) + 60,
    });
    if (!summary.gameId) throw new Error(`Registrar did not return a game id for ${gameName}`);
    games.push({ gameId: summary.gameId, gameName });
  }
  return games;
}

function resolveSystemAddresses(manifest: WorldManifest): HarnessSystemAddresses {
  return {
    blitzRealm: requireContract(manifest, "s2-blitz_realm_systems"),
    production: requireContract(manifest, "s2-production_systems"),
    troopManagement: requireContract(manifest, "s2-troop_management_systems"),
    troopMovement: requireContract(manifest, "s2-troop_movement_systems"),
  };
}

function requireContract(manifest: WorldManifest, tag: string): string {
  const contract = manifest.contracts.find((candidate) => candidate.tag === tag);
  if (!contract?.address || BigInt(contract.address) === 0n) {
    throw new Error(`Manifest does not define ${tag}`);
  }
  return contract.address;
}

function resolveMinimumCompletedActions(options: HarnessCliOptions, plannedActions: number): number {
  const isAcceptanceRun =
    options.games === 1 && options.bots === 96 && options.minutes === 10 && options.intervalSeconds === 15;
  return isAcceptanceRun ? 3_500 : plannedActions;
}

function parseFlags(args: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!;
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument ${flag}`);
    const name = flag.slice(2);
    if (name === "help") {
      values.help = "true";
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer`);
  return parsed;
}

function positiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number`);
  return parsed;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function printUsage(): void {
  console.log(`
Usage: bun deploy/madara-lab/harness/run.ts [options]

  --bots <count>                 default: 96, maximum: 96
  --games <count>                default: 1; runs all games concurrently in this process
  --minutes <minutes>            default: 10
  --interval-seconds <seconds>   default: 15
  --setup-concurrency <count>    default: 6
  --game-id <id>                 use an existing dev-mode game instead of creating one
  --game-name <name>             name for a new game or report label for --game-id
  --rpc-url <url>                default: ${DEFAULT_RPC_URL}
  --torii-sql-url <url>          default: ${DEFAULT_TORII_SQL_URL}
`);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
