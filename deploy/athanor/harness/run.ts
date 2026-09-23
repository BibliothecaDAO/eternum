#!/usr/bin/env bun
import { launchFrontierSeason, runFrontierWorkload } from "./frontier";
import { FRONTIER_ACCELERATED_PRESET_ID } from "../../../config/source/common/native-preset-modes";
import { createBuildOrderWorkload } from "./build-order";
import { runLayerRoundTrip } from "./layer-round-trip";
import { closeHarnessSeason } from "./season-lifecycle";
import { nativePresetForId, nativePresetIdFor } from "../../../config/source/native";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Worker, isMainThread, parentPort, workerData, threadId } from "node:worker_threads";
import path from "node:path";
import { DeviceSigner, deviceKeyOf, signGameplayIntent } from "@bibliothecadao/eternum";
import { splitPlaytestRoster } from "../../../apps/launch-service/src/slots";
import { configureGameplayAccountSubmits, openShard } from "@bibliothecadao/eternum/game-client";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { Account, logger } from "starknet";
import { assertChainId } from "../../../packages/chain/chain-guard.js";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { createHarnessAccounts, type HarnessAccount } from "./account-factory";
import { connectHarnessGameClient, type HarnessGameplayContracts } from "./game-client";
import { createHarnessGame } from "./harness-game";
import { HarnessProvider, measureHarnessRequests } from "./provider";
import { prepareHarnessBots, runWorkload, type HarnessGameType, type TrackedTransaction } from "./driver";
import { registerBotsThroughSlot } from "./slot-registration";
import {
  HARNESS_OUTPUT_DIRECTORY,
  assessRosterRun,
  collectHarnessEvidenceBeforeRun,
  finishHarnessEvidence,
  readDriverPlacement,
  writeHarnessReport,
  type HarnessEvidence,
  type HarnessGameInstance,
  type WorkerWorkloadSummary,
} from "./report";

interface HarnessCliOptions {
  workload: "build-order" | "burst" | "cadence" | "frontier";
  functional: boolean;
  gameType: HarnessGameType;
  /** The preset new games are created from; the campaign names one per configuration. */
  presetId: number;
  bots: number;
  games?: number;
  accountsPerGame?: number;
  gameId?: number;
  preparedGamePath?: string;
  gameName?: string;
  /** The slot shape: bots register into this free Blitz slot and the launch service creates the games. */
  slot?: { name: string; launchUrl: string; closesInSeconds: number };
  intervalSeconds: number;
  minutes: number;
  rpcUrl: string;
  setupConcurrency: number;
  heraldUrl: string;
}

interface GameplayContractsArtifact extends HarnessGameplayContracts {
  rpcUrl?: string;
}

interface LaunchedGame extends Omit<HarnessGameInstance, "botCount"> {
  startAt?: number;
}

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const MADARA_ADMIN_ADDRESS = "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d";
const MADARA_ADMIN_PRIVATE_KEY = "0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07";

logger.setLogLevel("FATAL");

export function parseHarnessArgs(args: string[]): HarnessCliOptions {
  const values = parseFlags(args);
  if (values.help === "true") {
    printUsage();
    process.exit(0);
  }

  const games = values.games === undefined ? undefined : positiveInteger(values.games, "games");
  const accountsPerGame =
    games === undefined ? undefined : positiveInteger(values["accounts-per-game"] ?? "24", "accounts-per-game");
  if (games !== undefined && values.bots !== undefined)
    throw new Error("Use --games with --accounts-per-game, or --bots");
  if (games === undefined && values["accounts-per-game"] !== undefined)
    throw new Error("--accounts-per-game requires --games");
  if (accountsPerGame !== undefined && accountsPerGame > 24)
    throw new Error("Regular Blitz has at most 24 players per game");
  const bots =
    games === undefined
      ? positiveInteger(values.bots ?? "96", "bots")
      : positiveInteger(String(games * accountsPerGame!), "total accounts");
  const minutes = positiveNumber(values.minutes ?? "10", "minutes");
  const intervalSeconds = positiveNumber(values["interval-seconds"] ?? "15", "interval-seconds");
  const setupConcurrency = positiveInteger(values["setup-concurrency"] ?? "6", "setup-concurrency");
  const gameId = values["game-id"] === undefined ? undefined : positiveInteger(values["game-id"], "game-id");
  const gameType = values["game-type"] ?? "blitz";
  if (gameType !== "blitz" && gameType !== "eternum" && gameType !== "frontier")
    throw new Error("--game-type must be blitz, eternum or frontier");
  const workload =
    values.workload ??
    { frontier: "frontier", eternum: "cadence", blitz: "build-order" }[values["game-type"] ?? "blitz"];
  if (workload !== "build-order" && workload !== "burst" && workload !== "cadence" && workload !== "frontier")
    throw new Error("--workload must be build-order, burst, cadence or frontier");
  if ((gameType === "frontier") !== (workload === "frontier"))
    throw new Error("Frontier requires the frontier workload");
  const functional = values.functional === "true";
  const presetId = values.preset === undefined ? defaultPresetFor(gameType, functional) : positiveInteger(values.preset, "preset");
  nativePresetForId(presetId);
  if (gameType === "frontier" && functional && bots < 2)
    throw new Error("Frontier design run requires both player profiles");
  if (gameType === "eternum" && workload === "build-order") throw new Error("Build-order workload requires Blitz");
  if (gameType !== "blitz" && games !== undefined) throw new Error("--games requires Regular Blitz");
  if (gameType === "blitz" && gameId !== undefined)
    throw new Error("Blitz harness creates its fixed roster before launching; omit --game-id");
  if (bots > 24 && gameId !== undefined) throw new Error("An existing game cannot be split across games");
  if (gameId !== undefined && !values["game-name"]) {
    values["game-name"] = `game-${gameId}`;
  }
  const slot = resolveSlotOptions(values, gameType, games);

  return {
    gameType,
    workload,
    functional,
    presetId,
    bots,
    games,
    accountsPerGame,
    gameId,
    preparedGamePath: values["prepared-game"],
    gameName: values["game-name"],
    slot,
    intervalSeconds,
    minutes,
    rpcUrl: requiredEndpoint(values["rpc-url"], "rpc-url", "RPC_URL"),
    setupConcurrency,
    heraldUrl: requiredEndpoint(values["herald-url"], "herald-url", "HERALD_URL"),
  };
}

async function main(): Promise<void> {
  const options = parseHarnessArgs(process.argv.slice(2));
  const gameplayContractsPath = requiredEnvironmentValue("GAMEPLAY_CONTRACTS_PATH", "native harness");
  process.env.HERALD_URL = options.heraldUrl;

  const requests = options.functional ? undefined : measureHarnessRequests(options.rpcUrl);
  const provider = createHarnessProvider(options.rpcUrl);
  const [chainId, gameplayContracts, shard] = await Promise.all([
    provider.getChainId(),
    readJson<GameplayContractsArtifact>(path.resolve(REPOSITORY_ROOT, gameplayContractsPath)),
    openShard(options.heraldUrl, bindings.schemaIdentity),
  ]);
  assertChainId(chainId, { shard }, "RPC_URL");
  const prepared = options.preparedGamePath
    ? await readJson<PreparedGame>(path.resolve(options.preparedGamePath))
    : await prepareGames(options, gameplayContracts, provider);
  if (Array.isArray(prepared) || prepared.accounts.length > 1) {
    provider.dispose();
    requests?.dispose();
    await runRosterGroups(options, Array.isArray(prepared) ? prepared : [prepared]);
    return;
  }
  const { game } = prepared;
  if (prepared.accounts.length !== options.bots) throw new Error("Prepared roster size does not match --bots");
  const accounts: HarnessAccount[] = prepared.accounts.map((account) => ({
    ...account,
    account: configureGameplayAccountSubmits(
      new Account({ provider, address: account.address, signer: new DeviceSigner(deviceKeyOf(account.privateKey)) }),
      chainId,
    ),
  }));
  const signingKeys = new Map(accounts.map(({ address, privateKey }) => [BigInt(address), privateKey]));
  const { client, heraldConfirmations } = await connectHarnessGameClient({
    actor: accounts[0].address,
    shard,
    signIntent: async (actor, digest) => {
      const key = signingKeys.get(BigInt(actor.address));
      if (!key) throw new Error(`No harness signing key for ${actor.address}`);
      return signGameplayIntent(digest, key);
    },
    gameId: game.gameId,
  });

  try {
    const harnessGame = createHarnessGame(client, heraldConfirmations);
    const setupTransactions: TrackedTransaction[] = [];
    const bots =
      options.gameType === "frontier"
        ? []
        : await prepareHarnessBots({
            gameType: options.gameType,
            accounts,
            game: harnessGame,
            provider,
            setupConcurrency: options.setupConcurrency,
            setupTransactions,
          });

    const isRosterWorker = Boolean(workerData?.harness);
    const evidenceBefore = isRosterWorker ? null : await collectHarnessEvidenceBeforeRun(options.functional);
    if (!options.functional) console.log("Waiting for explorers to recover before measuring the workload");
    const workload =
      options.workload === "frontier"
        ? await runFrontierWorkload({
            accelerated: options.functional,
            client,
            game: harnessGame,
            provider,
            accounts,
            minutes: options.minutes,
            onReady: workerData?.harness ? waitForWorkloadStart : undefined,
            setupTransactions,
          })
        : await runWorkload({
            bots,
            buildOrder: options.workload === "build-order" ? createBuildOrderWorkload(client, harnessGame) : undefined,
            burst: options.workload === "burst",
            game: harnessGame,
            intervalSeconds: options.intervalSeconds,
            minutes: options.minutes,
            onReady: async () => {
              if (workerData?.harness) await waitForWorkloadStart();
              requests?.start();
            },
            onTick: (completed, total) => {
              if (completed === 1 || completed === total || completed % 5 === 0) {
                console.log(`Scheduled workload tick ${completed}/${total}`);
              }
            },
            provider,
          });

    const transportRequests = requests?.finish();
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

    const gates = evidenceBefore
      ? {
          minimumThresholdActions: resolveMinimumThresholdActions(options, workload.plannedActions),
          evidence: await finishHarnessEvidence(evidenceBefore, workload.startedAt, workload.endedAt, options.functional),
        }
      : null;
    const report = await writeHarnessReport({
      functional: options.functional,
      accounts,
      botCount: options.bots,
      chainId,
      driver: await readDriverPlacement(),
      games: [{ ...game, botCount: options.bots }],
      intervalSeconds: options.intervalSeconds,
      gates,
      minutes: options.minutes,
      receipts: provider,
      rpcUrl: options.rpcUrl,
      setupTransactions,
      heraldUrl: options.heraldUrl,
      workload,
      seasonFinalizations,
      layerRoundTrips,
      transportRequests,
    });

    parentPort?.postMessage({ type: "result", ...report, pid: process.pid, threadId });
    console.log(`${report.passed ? "PASS" : "FAIL"}: ${report.path}`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    client.dispose();
    provider.dispose();
    requests?.dispose();
  }
}

export const createHarnessProvider = (rpcUrl: string): HarnessProvider => new HarnessProvider(rpcUrl);

async function resolveHarnessGame(options: HarnessCliOptions, rosterAccounts: string[]): Promise<LaunchedGame> {
  if (options.gameId !== undefined) {
    return { gameId: options.gameId, gameName: options.gameName!, settlementTransactions: null };
  }

  const gameName = options.gameName ?? `lab-${Date.now().toString(36)}`;
  if (options.gameType === "frontier") {
    const provider = createHarnessProvider(options.rpcUrl);
    try {
      return await launchFrontierSeason(provider, gameName, options.minutes, options.presetId);
    } finally {
      provider.dispose();
    }
  }
  const startAt = Math.floor(Date.now() / 1_000) + 60;
  const summary = await launchGame({
    manifest: readShardManifest<NativeWorldManifest>(process.env.NATIVE_WORLD_MANIFEST),
    heraldUrl: options.heraldUrl,
    accountAddress: process.env.DEPLOYER_ACCOUNT_ADDRESS ?? MADARA_ADMIN_ADDRESS,
    devModeOn: false,
    durationSeconds: Math.ceil(options.minutes * 60) + 3_600,
    environmentId: options.gameType === "eternum" ? "madara.eternum" : "madara.blitz",
    gameName,
    rosterAccounts: options.gameType === "blitz" ? rosterAccounts : undefined,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY ?? MADARA_ADMIN_PRIVATE_KEY,
    rpcUrl: options.rpcUrl,
    startTime: startAt,
    version: String(options.presetId),
  });
  if (!summary.gameId) throw new Error(`Registrar did not return a game id for ${gameName}`);
  return { gameId: summary.gameId, gameName, startAt, settlementTransactions: summary.settlementTransactions ?? 0 };
}

function resolveSlotOptions(
  values: Record<string, string>,
  gameType: HarnessGameType,
  games: number | undefined,
): HarnessCliOptions["slot"] {
  if (values.slot === undefined) {
    if (values["launch-url"] !== undefined || values["slot-closes-in-seconds"] !== undefined)
      throw new Error("--launch-url and --slot-closes-in-seconds require --slot");
    return undefined;
  }
  if (gameType !== "blitz") throw new Error("--slot registers into a free Blitz slot; use --game-type blitz");
  if (games !== undefined || values["game-name"] !== undefined)
    throw new Error("--slot lets the launch service split and name the games; omit --games and --game-name");
  const launchUrl = values["launch-url"] ?? process.env.LAUNCH_URL;
  if (!launchUrl) throw new Error("--slot requires --launch-url or LAUNCH_URL (the app origin the launch API is served under)");
  return {
    name: values.slot,
    launchUrl,
    closesInSeconds: positiveInteger(values["slot-closes-in-seconds"] ?? "120", "slot-closes-in-seconds"),
  };
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
        "functional",
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
        "accounts-per-game",
        "preset",
        "slot",
        "launch-url",
        "slot-closes-in-seconds",
      ].includes(name)
    ) {
      throw new Error(`Unsupported harness option --${name}`);
    }
    if (name === "help" || name === "functional") {
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
    classHash: contracts.playerAccountClassHash,
    concurrency: options.setupConcurrency,
    count: options.bots,
    gameId: 0,
    provider,
  });
  if (options.slot) return prepareSlotGames(options.slot, accounts);
  const groups =
    options.games !== undefined
      ? Array.from({ length: options.games }, (_, index) =>
          accounts.slice(index * options.accountsPerGame!, (index + 1) * options.accountsPerGame!),
        )
      : options.gameType === "blitz"
        ? splitPlaytestRoster(accounts)
        : [accounts];
  const prefix = options.gameName ?? `lab-${Date.now().toString(36)}`;
  const prepared: PreparedGame[] = [];
  // Setup shares an authority account. Finish it before concurrent player workloads start.
  for (const [index, group] of groups.entries()) {
    const game = await resolveHarnessGame(
      { ...options, gameName: groups.length > 1 ? `${prefix}-${index + 1}` : prefix },
      group.map(({ address }) => address),
    );
    prepared.push({
      game,
      accounts: group.map(({ account: _account, ...entry }) => ({ ...entry, gameId: game.gameId })),
    });
  }
  return prepared.length === 1 ? prepared[0] : prepared;
}

/** The slot shape: the launch service splits, names, creates and settles the games; the harness drives what it made. */
async function prepareSlotGames(
  slot: NonNullable<HarnessCliOptions["slot"]>,
  accounts: HarnessAccount[],
): Promise<PreparedGame[]> {
  const games = await registerBotsThroughSlot(
    { origin: slot.launchUrl, token: requiredEnvironmentValue("OPERATOR_TOKEN", "harness slot registration") },
    { slotName: slot.name, accounts: accounts.map(({ address }) => address), closesInSeconds: slot.closesInSeconds },
  );
  const byAddress = new Map(accounts.map((account) => [BigInt(account.address), account]));
  return games.map(({ gameId, gameName, settlementTransactions, accounts: roster }) => ({
    game: { gameId, gameName, settlementTransactions },
    accounts: roster.map((address) => {
      const { account: _account, ...entry } = byAddress.get(BigInt(address))!;
      return { ...entry, gameId };
    }),
  }));
}

interface GameWorkerReport {
  passed: boolean;
  path: string;
  pid: number;
  threadId: number;
  workload: WorkerWorkloadSummary;
}

// One driver process runs every player as a worker thread. Evidence is read once here, never per worker, and the
// run's gates (action threshold, latency bars, close cost) are asserted over the whole run: a worker only reports.
async function runRosterGroups(options: HarnessCliOptions, games: PreparedGame[]): Promise<void> {
  const players = games.flatMap(({ game, accounts }) => accounts.map((account) => ({ game, accounts: [account] })));
  const directory = path.join(HARNESS_OUTPUT_DIRECTORY, `rosters-${Date.now()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const workers: Worker[] = [];
  const reports: GameWorkerReport[] = [];
  const evidenceBefore = await collectHarnessEvidenceBeforeRun(options.functional);
  let failure: unknown;
  try {
    const paths = await Promise.all(
      players.map(async (game) => {
        const file = path.join(directory, `${game.game.gameId}-${game.accounts[0].botId}.json`);
        await writeFile(file, JSON.stringify(game), { mode: 0o600 });
        return file;
      }),
    );
    for (const [index, game] of players.entries()) workers.push(startGameWorker(options, game, paths[index]));
    await waitForGameWorkers(workers, reports);
  } catch (error) {
    failure = error;
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  let evidence: HarnessEvidence | null = null;
  try {
    evidence = await finishRosterEvidence(evidenceBefore, reports, options.functional);
  } catch (error) {
    failure ??= error;
  }
  const workloads = reports.map((report) => report.workload);
  const gates = assessRosterRun({
    functional: options.functional,
    workers: workloads,
    minimumThresholdActions: resolveMinimumThresholdActions(
      options,
      workloads.reduce((sum, workload) => sum + workload.plannedActions, 0),
    ),
  });
  const workersPassed =
    reports.length === players.length && reports.every((report) => report.passed && report.pid === process.pid);
  const passed = !failure && workersPassed && gates.passed;
  const summary = {
    passed,
    driver: { ...(await readDriverPlacement()), workers: workers.length },
    games: games.map(({ game, accounts }) => ({ ...game, botCount: accounts.length })),
    gates: { ...gates, checks: { ...gates.checks, workers: workersPassed } },
    reports: reports.map(({ workload: _workload, ...report }) => report),
    evidence,
    error: failure instanceof Error ? failure.message : failure === undefined ? undefined : String(failure),
  };
  const output = path.join(directory, "summary.json");
  await writeFile(output, JSON.stringify(summary, null, 2) + "\n");
  if (!passed) throw new Error(`Roster workload failed: ${output}`, { cause: failure });
  console.log(`PASS: ${output}`);
}

async function finishRosterEvidence(
  before: Awaited<ReturnType<typeof collectHarnessEvidenceBeforeRun>>,
  reports: GameWorkerReport[],
  functional: boolean,
): Promise<HarnessEvidence | null> {
  if (reports.length === 0) return null;
  const startedAt = reports.map(({ workload }) => workload.startedAt).sort()[0]!;
  const endedAt = reports.map(({ workload }) => workload.endedAt).sort().at(-1)!;
  return finishHarnessEvidence(before, startedAt, endedAt, functional);
}

function startGameWorker(options: HarnessCliOptions, game: PreparedGame, file: string): Worker {
  return new Worker(import.meta.filename, {
    workerData: { harness: true },
    env: {
      ...process.env,
      HARNESS_OUTPUT_DIRECTORY: path.join(
        path.dirname(file),
        "players",
        `${game.game.gameId}-${game.accounts[0].botId}`,
      ),
    },
    argv: [
      ...(options.functional ? ["--functional"] : []),
      "--game-type",
      options.gameType,
      "--bots",
      String(game.accounts.length),
      "--prepared-game",
      file,
      "--minutes",
      String(options.minutes),
      "--interval-seconds",
      String(options.intervalSeconds),
      "--setup-concurrency",
      String(options.setupConcurrency),
      "--workload",
      options.workload,
      "--preset",
      String(options.presetId),
      "--rpc-url",
      options.rpcUrl,
      "--herald-url",
      options.heraldUrl,
    ],
  });
}

export async function waitForGameWorkers(workers: Worker[], reports: GameWorkerReport[]): Promise<void> {
  const ready = new Set<Worker>();
  await Promise.all(
    workers.map(
      (worker) =>
        new Promise<void>((resolve, reject) => {
          let reported: GameWorkerReport | undefined;
          worker.on("message", (message) => {
            if (message.type === "failure") {
              reject(new Error(message.error));
            } else if (message.type === "ready" && !ready.has(worker)) {
              ready.add(worker);
              if (ready.size === workers.length) {
                const startAt = Date.now() + 1_000;
                for (const player of workers) player.postMessage({ type: "start", startAt });
              }
            } else if (message.type === "result" && !reported) {
              reported = message;
              reports.push(message);
            }
          });
          worker.once("error", reject);
          worker.once("exit", (code) =>
            reported && code === (reported.passed ? 0 : 1)
              ? resolve()
              : reject(new Error(`Game worker exited ${code} without a matching result`)),
          );
        }),
    ),
  );
}

async function waitForWorkloadStart(): Promise<void> {
  if (!parentPort) throw new Error("A game worker requires its driver port");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Other games did not become ready within ten minutes")), 600_000);
    parentPort!.once("message", async (message) => {
      clearTimeout(timeout);
      if (message.type !== "start") return reject(new Error("Unexpected driver message"));
      await Bun.sleep(Math.max(0, message.startAt - Date.now()));
      resolve();
    });
    parentPort!.postMessage({ type: "ready" });
  });
}

/** A Frontier design run plays the accelerated fixture preset; every other run plays its mode's own. */
function defaultPresetFor(gameType: HarnessGameType, functional: boolean): number {
  return gameType === "frontier" && functional ? FRONTIER_ACCELERATED_PRESET_ID : nativePresetIdFor(gameType);
}

/** A shard endpoint has no default: a lab port that answers for the wrong shard is worse than a loud stop. */
function requiredEndpoint(flagValue: string | undefined, flag: string, environmentName: string): string {
  const value = flagValue ?? process.env[environmentName]?.trim();
  if (!value) throw new Error(`--${flag} or ${environmentName} is required`);
  return value;
}

function requiredEnvironmentValue(name: string, context: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for ${context}`);
  return value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer`);
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
  --games <count>                explicit concurrent games in one process, one client worker per player
  --accounts-per-game <count>    with --games; default: 24, maximum: 24
  --game-type <blitz|eternum|frontier>     default: blitz
  --minutes <minutes>            default: 10
  --interval-seconds <seconds>   default: 15
  --setup-concurrency <count>    default: 6
  --workload <build-order|burst|cadence|frontier> default: the game type’s workload; burst submits every plan at once
  --preset <id>                  preset new games are created from; default: the game type’s preset
  --slot <name>                  register the bots into this free Blitz slot through the launch API instead of
                                 creating games; needs OPERATOR_TOKEN and --launch-url or LAUNCH_URL
  --launch-url <origin>          the app origin the launch API is served under, e.g. https://staging.realms.party
  --slot-closes-in-seconds <s>   with --slot; default: 120; the cron freezes the slot within a minute of closing
  --functional                  omit capacity collection and latency gates; for Frontier, the accelerated design run
  --prepared-game <path>         resume a prepared roster using its private account file
  --game-id <id>                 use an existing Eternum game
  --game-name <name>             name for a new game or report label for --game-id
  --rpc-url <url>                required, or RPC_URL; the node's internal URL, never the public RPC
  --herald-url <url>             required, or HERALD_URL
`);
}

if (import.meta.main || (!isMainThread && workerData?.harness)) {
  await main().catch((error: unknown) => {
    parentPort?.postMessage({ type: "failure", error: error instanceof Error ? error.message : String(error) });
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
