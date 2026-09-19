#!/usr/bin/env bun
import { createBuildOrderWorkload } from "./build-order";
import { runLayerRoundTrip } from "./layer-round-trip";
import { closeHarnessSeason } from "./season-lifecycle";
import { defaultPresetForEnvironment } from "../../../config/deployer/clean/constants";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bindGameplayAccounts } from "@bibliothecadao/eternum";
import { splitPlaytestRoster } from "../../../apps/launch-service/src/slots";
import { configureGameplayAccountSubmits, type CommittedManifest } from "@bibliothecadao/eternum/game-client";
import { Account, ec, logger } from "starknet";
import { assertChainId } from "../../../packages/chain/chain-guard.js";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import { createHarnessAccounts, type HarnessAccount } from "./account-factory";
import { connectHarnessGameClient, type HarnessGameplayContracts } from "./game-client";
import { createHarnessGame } from "./harness-game";
import { HarnessProvider } from "./provider";
import { prepareHarnessBots, runWorkload, type HarnessGameType, type TrackedTransaction } from "./driver";
import { collectHarnessEvidenceBeforeRun, finishHarnessEvidence, writeHarnessReport } from "./report";

interface HarnessCliOptions {
  workload: "build-order" | "cadence";
  gameType: HarnessGameType;
  bots: number;
  gameId?: number;
  preparedGamePath?: string;
  gameName?: string;
  intervalSeconds: number;
  minutes: number;
  rpcUrl: string;
  setupConcurrency: number;
  heraldUrl: string;
}

interface GameplayContractsArtifact extends HarnessGameplayContracts {
  rpcUrl?: string;
}

interface WorldManifest extends CommittedManifest {
  contracts: Array<{ address: string; selector: string; tag: string; systems: string[] }>;
}

interface LaunchedGame {
  gameId: number;
  gameName: string;
  startAt?: number;
}

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const DEFAULT_RPC_URL = "http://127.0.0.1:5050/rpc/v0_9_0";
const DEFAULT_HERALD_URL = "http://127.0.0.1:3003";
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
  const workload = values.workload ?? (values["game-type"] === "eternum" ? "cadence" : "build-order");
  if (workload !== "build-order" && workload !== "cadence")
    throw new Error("--workload must be build-order or cadence");
  const gameType = values["game-type"] ?? "blitz";
  if (gameType !== "blitz" && gameType !== "eternum") throw new Error("--game-type must be blitz or eternum");
  if (gameType === "eternum" && workload === "build-order") throw new Error("Build-order workload requires Blitz");
  if (bots > 96) throw new Error(`The harness supports at most 96 bots, received ${bots}`);
  if (values.games !== undefined)
    throw new Error("The game client holds one game per process; run one harness per game");
  if (gameType === "blitz" && gameId !== undefined)
    throw new Error("Blitz harness creates its fixed roster before launching; omit --game-id");
  if (bots > 24 && gameId !== undefined) throw new Error("An existing game cannot be split across harness processes");
  if (gameId !== undefined && !values["game-name"]) {
    values["game-name"] = `game-${gameId}`;
  }

  return {
    gameType,
    workload,
    bots,
    gameId,
    preparedGamePath: values["prepared-game"],
    gameName: values["game-name"],
    intervalSeconds,
    minutes,
    rpcUrl: values["rpc-url"] ?? process.env.RPC_URL ?? DEFAULT_RPC_URL,
    setupConcurrency,
    heraldUrl: values["herald-url"] ?? process.env.HERALD_URL ?? DEFAULT_HERALD_URL,
  };
}

async function main(): Promise<void> {
  const options = parseHarnessArgs(process.argv.slice(2));
  const manifestPath = requiredEnvironmentValue("NATIVE_WORLD_MANIFEST", "native harness");
  const admissionUrl = requiredEnvironmentValue("ADMISSION_URL", "native harness");
  const gameplayContractsPath = requiredEnvironmentValue("GAMEPLAY_CONTRACTS_PATH", "native harness");
  process.env.HERALD_URL = options.heraldUrl;

  const provider = createHarnessProvider(options.rpcUrl);
  const [chainId, gameplayContracts, manifest] = await Promise.all([
    provider.getChainId(),
    readJson<GameplayContractsArtifact>(path.resolve(REPOSITORY_ROOT, gameplayContractsPath)),
    readJson<WorldManifest>(path.resolve(REPOSITORY_ROOT, manifestPath)),
  ]);
  assertChainId(chainId, "madara", "RPC_URL");
  if (BigInt(gameplayContracts.playerRegistryAddress) !== 0n) {
    requiredEnvironmentValue("BINDING_AUTHORITY_PRIVATE_KEY", "harness with PlayerRegistry");
  }
  const prepared = options.preparedGamePath
    ? await readJson<PreparedGame>(path.resolve(options.preparedGamePath))
    : await prepareGames(options, gameplayContracts, provider);
  if (Array.isArray(prepared)) {
    provider.dispose();
    await runRosterGroups(options, prepared);
    return;
  }
  const { game } = prepared;
  if (prepared.accounts.length !== options.bots) throw new Error("Prepared roster size does not match --bots");
  const accounts: HarnessAccount[] = prepared.accounts.map((account) => ({
    ...account,
    account: configureGameplayAccountSubmits(
      new Account({ provider, address: account.address, signer: account.privateKey }),
      "madara",
    ),
  }));
  const signingKeys = new Map(accounts.map(({ address, privateKey }) => [BigInt(address), privateKey]));
  const client = await connectHarnessGameClient({
    admissionUrl,
    chainId,
    signIntent: async (actor, digest) => {
      const key = signingKeys.get(BigInt(actor.address));
      if (!key) throw new Error(`No harness signing key for ${actor.address}`);
      const signature = ec.starkCurve.sign(digest, key);
      return { r: signature.r, s: signature.s, publicKey: BigInt(ec.starkCurve.getStarkKey(key)) };
    },
    gameId: game.gameId,
    gameplayContracts,
    heraldUrl: options.heraldUrl,
    manifest,
    rpcUrl: options.rpcUrl,
  });

  try {
    const harnessGame = createHarnessGame(client);
    const setupTransactions: TrackedTransaction[] = [];
    if (options.gameType === "eternum" && game.startAt) await waitForGameStart(provider, game.startAt);
    const bots = await prepareHarnessBots({
      gameType: options.gameType,
      accounts,
      game: harnessGame,
      provider,
      setupConcurrency: options.setupConcurrency,
      setupTransactions,
    });

    const evidenceBefore = await collectHarnessEvidenceBeforeRun();
    console.log(
      "Waiting for every explorer to recover setup stamina to its configured capacity, then starting the measured workload",
    );
    const workload = await runWorkload({
      bots,
      buildOrder: options.workload === "build-order" ? createBuildOrderWorkload(client, harnessGame) : undefined,
      game: harnessGame,
      intervalSeconds: options.intervalSeconds,
      minutes: options.minutes,
      onTick: (completed, total) => {
        if (completed === 1 || completed === total || completed % 5 === 0) {
          console.log(`Scheduled workload tick ${completed}/${total}`);
        }
      },
      provider,
    });

    const layerRoundTrips =
      options.gameType === "eternum"
        ? [
            await runLayerRoundTrip({
              bots,
              gameId: game.gameId,
              provider,
              client,
              game: harnessGame,
            }),
          ]
        : [];

    const seasonFinalizations =
      options.gameType === "eternum"
        ? [
            await closeHarnessSeason({
              accounts,
              client,
              game: harnessGame,
              provider,
            }),
          ]
        : [];

    const evidence = await finishHarnessEvidence(evidenceBefore, workload.startedAt, workload.endedAt);
    const minimumThresholdActions = resolveMinimumThresholdActions(options, workload.plannedActions);
    const report = await writeHarnessReport({
      accounts,
      botCount: options.bots,
      chainId,
      evidence,
      games: [{ ...game, botCount: options.bots }],
      intervalSeconds: options.intervalSeconds,
      minimumThresholdActions,
      minutes: options.minutes,
      rpcUrl: options.rpcUrl,
      setupTransactions,
      heraldUrl: options.heraldUrl,
      workload,
      seasonFinalizations,
      layerRoundTrips,
    });

    console.log(`${report.passed ? "PASS" : "FAIL"}: ${report.path}`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    client.dispose();
    provider.dispose();
  }
}

export const createHarnessProvider = (rpcUrl: string): HarnessProvider => new HarnessProvider(rpcUrl);

async function resolveHarnessGame(options: HarnessCliOptions, rosterOwners: string[]): Promise<LaunchedGame> {
  if (options.gameId !== undefined) {
    return { gameId: options.gameId, gameName: options.gameName! };
  }

  const gameName = options.gameName ?? `lab-${Date.now().toString(36)}`;
  const startAt = Math.floor(Date.now() / 1_000) + 60;
  const summary = await launchGame({
    accountAddress: process.env.DEPLOYER_ACCOUNT_ADDRESS ?? MADARA_ADMIN_ADDRESS,
    devModeOn: false,
    durationSeconds: Math.ceil(options.minutes * 60) + 3_600,
    environmentId: options.gameType === "eternum" ? "madara.eternum" : "madara.blitz",
    gameName,
    rosterOwners: options.gameType === "blitz" ? rosterOwners : undefined,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY ?? MADARA_ADMIN_PRIVATE_KEY,
    rpcUrl: options.rpcUrl,
    startTime: startAt,
    version: defaultPresetForEnvironment(options.gameType === "eternum" ? "madara.eternum" : "madara.blitz"),
  });
  if (!summary.gameId) throw new Error(`Registrar did not return a game id for ${gameName}`);
  return { gameId: summary.gameId, gameName, startAt };
}

function resolveMinimumThresholdActions(options: HarnessCliOptions, plannedActions: number): number {
  const isAcceptanceRun = options.bots === 96 && options.minutes === 10 && options.intervalSeconds === 15;
  return isAcceptanceRun ? 3_500 : plannedActions;
}

function parseFlags(args: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!;
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument ${flag}`);
    const name = flag.slice(2);
    if (
      ![
        "help",
        "bots",
        "minutes",
        "interval-seconds",
        "setup-concurrency",
        "game-id",
        "game-name",
        "prepared-game",
        "workload",
        "game-type",
        "rpc-url",
        "herald-url",
        "games",
      ].includes(name)
    ) {
      throw new Error(`Unsupported harness option --${name}`);
    }
    if (name === "help") {
      values[name] = "true";
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

interface PreparedGame {
  game: LaunchedGame;
  accounts: Omit<HarnessAccount, "account">[];
}

async function prepareGames(
  options: HarnessCliOptions,
  contracts: GameplayContractsArtifact,
  provider: HarnessProvider,
): Promise<PreparedGame | PreparedGame[]> {
  const accounts = await createHarnessAccounts({
    authority: contracts.bindingAuthorityAddress,
    classHash: contracts.playerAccountClassHash,
    concurrency: options.setupConcurrency,
    count: options.bots,
    gameId: 0,
    provider,
  });
  await bindGameplayAccounts({
    accounts: accounts.map(({ address, owner }) => ({ address, owner })),
    authority: new Account({
      provider,
      address: contracts.bindingAuthorityAddress,
      signer: requiredEnvironmentValue("BINDING_AUTHORITY_PRIVATE_KEY", "harness"),
    }),
    chain: "madara",
    playerRegistryAddress: contracts.playerRegistryAddress,
    provider,
  });
  const groups = options.gameType === "blitz" ? splitPlaytestRoster(accounts) : [accounts];
  const prefix = options.gameName ?? `lab-${Date.now().toString(36)}`;
  const prepared: PreparedGame[] = [];
  // Setup shares an authority account. Finish it before concurrent player workloads start.
  for (const [index, group] of groups.entries()) {
    const game = await resolveHarnessGame(
      { ...options, gameName: groups.length > 1 ? `${prefix}-${index + 1}` : prefix },
      group.map(({ owner }) => owner),
    );
    prepared.push({
      game,
      accounts: group.map(({ account: _account, ...entry }) => ({ ...entry, gameId: game.gameId })),
    });
  }
  return prepared.length === 1 ? prepared[0] : prepared;
}

async function runRosterGroups(options: HarnessCliOptions, games: PreparedGame[]): Promise<void> {
  const directory = path.join(REPOSITORY_ROOT, "deploy/athanor/.lab/harness", `rosters-${Date.now()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const paths: string[] = [];
  for (const game of games) {
    const file = path.join(directory, `${game.game.gameId}.json`);
    await writeFile(file, JSON.stringify(game), { mode: 0o600 });
    paths.push(file);
  }
  const processes = games.map((game, index) =>
    Bun.spawn({
      cmd: [
        process.execPath,
        import.meta.filename,
        "--bots",
        String(game.accounts.length),
        "--prepared-game",
        paths[index],
        "--minutes",
        String(options.minutes),
        "--interval-seconds",
        String(options.intervalSeconds),
        "--setup-concurrency",
        String(options.setupConcurrency),
        "--workload",
        options.workload,
        "--rpc-url",
        options.rpcUrl,
        "--herald-url",
        options.heraldUrl,
      ],
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  const exits = await Promise.all(processes.map((child) => child.exited));
  if (exits.some((code) => code !== 0))
    throw new Error(`Roster workload failed: exit codes ${exits.join(", ")}; prepared rosters: ${directory}`);
}

async function waitForGameStart(provider: HarnessProvider, target: number): Promise<void> {
  const deadline = Date.now() + Math.max(120_000, (target - Math.floor(Date.now() / 1_000)) * 1_000 + 120_000);
  while (Date.now() <= deadline) {
    const block = await provider.getBlock("latest");
    if (Number(block.timestamp) >= target) return;
    await Bun.sleep(1_000);
  }
  throw new Error(`Chain timestamp did not reach ${target}`);
}

function requiredEnvironmentValue(name: string, context: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for ${context}`);
  return value;
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
Usage: bun deploy/athanor/harness/run.ts [options]

  --bots <count>                 default: 96; Blitz splits into balanced games of up to 24
  --game-type <blitz|eternum>     default: blitz
  --minutes <minutes>            default: 10
  --interval-seconds <seconds>   default: 15
  --setup-concurrency <count>    default: 6
  --workload <build-order|cadence> default: build-order for Blitz, cadence for Eternum
  --prepared-game <path>         resume a prepared roster using its private account file
  --game-id <id>                 use an existing Eternum game
  --game-name <name>             name for a new game or report label for --game-id
  --rpc-url <url>                default: ${DEFAULT_RPC_URL}
  --herald-url <url>             default: ${DEFAULT_HERALD_URL}
`);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
