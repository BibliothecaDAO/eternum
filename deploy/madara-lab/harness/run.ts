#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Account, BlockTag, logger, RpcProvider } from "starknet";
import { assertChainId, assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import { createHarnessAccounts } from "./account-factory";
import { prepareHarnessBots, runWorkload, type HarnessSystemAddresses, type TrackedTransaction } from "./driver";
import {
  bindLedgerGameplayAccounts,
  finalizeLedgerGame,
  loadLedgerBotIdentities,
  registerLedgerBots,
  toHarnessGameplayIdentities,
  waitForGameStart,
  waitForRelayedLedgerRegistrations,
  type LedgerBotIdentity,
  type LedgerHarnessEvidence,
  type LedgerRegistrationRuntime,
} from "./ledger-mode";
import {
  readLedgerSweepManifest,
  sweepLedgerBalances,
  writeLedgerSweepReceipt,
} from "./ledger-money";
import { collectHarnessEvidenceBeforeRun, finishHarnessEvidence, writeHarnessReport } from "./report";

interface HarnessCliOptions {
  bots: number;
  gameId?: number;
  gameName?: string;
  games: number;
  intervalSeconds: number;
  ledger: boolean;
  ledgerAccountsPath?: string;
  ledgerStartDelaySeconds: number;
  minutes: number;
  rpcUrl: string;
  setupConcurrency: number;
  sweepOnlyManifestPath?: string;
  heraldUrl: string;
}

interface GameplayContractsArtifact {
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  rpcUrl?: string;
}

interface WorldManifest {
  contracts: Array<{ address: string; tag: string }>;
}

interface HarnessGame {
  gameId: number;
  gameName: string;
  startAt?: number;
}

interface LedgerEnvironment {
  authorityPrivateKey: string;
  ledgerAddress: string;
  lordsAddress: string;
  mainnetRpcUrl: string;
  treasuryAddress: string;
  treasuryPrivateKey: string;
}

interface LedgerSweepEnvironment {
  lordsAddress: string;
  mainnetRpcUrl: string;
  treasuryAddress: string;
}

interface PreparedGameRun {
  accounts: Awaited<ReturnType<typeof createHarnessAccounts>>;
  bots: Awaited<ReturnType<typeof prepareHarnessBots>>;
  game: HarnessGame;
  ledger?: {
    binding: LedgerHarnessEvidence["binding"];
    registration: LedgerHarnessEvidence["registration"];
    registrations: LedgerRegistrationRuntime[];
  };
}

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const LAB_DIRECTORY = path.resolve(import.meta.dir, "..");
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
  const games = positiveInteger(values.games ?? "1", "games");
  const ledger = values.ledger === "true";
  const sweepOnlyManifestPath = values["sweep-only"];
  const ledgerStartDelaySeconds = positiveInteger(
    values["ledger-start-delay-seconds"] ?? "900",
    "ledger-start-delay-seconds",
  );

  if (bots > 96) throw new Error(`The Madara Blitz preset supports at most 96 bots, received ${bots}`);
  if (gameId !== undefined && games !== 1) throw new Error("--game-id can only be used with --games 1");
  if (ledger && gameId !== undefined) throw new Error("--ledger always creates a fresh game; --game-id is not supported");
  if (ledger && games !== 1) throw new Error("--ledger supports one game per run");
  if (ledger && sweepOnlyManifestPath) throw new Error("--ledger and --sweep-only are separate modes");
  if ((ledger || sweepOnlyManifestPath) && !values["ledger-accounts"]) {
    throw new Error("--ledger-accounts is required with --ledger or --sweep-only");
  }
  if (!ledger && !sweepOnlyManifestPath && values["ledger-accounts"]) {
    throw new Error("--ledger-accounts requires --ledger or --sweep-only");
  }
  if (!ledger && values["ledger-start-delay-seconds"]) {
    throw new Error("--ledger-start-delay-seconds requires --ledger");
  }
  if (gameId !== undefined && !values["game-name"]) {
    values["game-name"] = `game-${gameId}`;
  }

  return {
    bots,
    gameId,
    gameName: values["game-name"],
    games,
    intervalSeconds,
    ledger,
    ledgerAccountsPath: values["ledger-accounts"],
    ledgerStartDelaySeconds,
    minutes,
    rpcUrl: values["rpc-url"] ?? process.env.RPC_URL ?? DEFAULT_RPC_URL,
    setupConcurrency,
    sweepOnlyManifestPath,
    heraldUrl: values["herald-url"] ?? process.env.HERALD_URL ?? DEFAULT_HERALD_URL,
  };
}

async function main(): Promise<void> {
  const options = parseHarnessArgs(process.argv.slice(2));
  if (options.sweepOnlyManifestPath) {
    await runLedgerSweepOnly(options);
    return;
  }
  // The launch path resolves the registrar from GAME_MANIFEST_PATH (registrar/calls.ts); default it to the madara
  // manifest so a redeployed lab uses the freshly migrated registrar, not the stale hardcoded constants.ts address.
  process.env.GAME_MANIFEST_PATH ??= "contracts/l3/game/manifest_madara.json";
  process.env.HERALD_URL = options.heraldUrl;

  const provider = createHarnessProvider(options.rpcUrl);
  const [chainId, gameplayContracts, manifest] = await Promise.all([
    provider.getChainId(),
    readJson<GameplayContractsArtifact>(path.join(LAB_DIRECTORY, ".lab/gameplay-contracts.json")),
    readJson<WorldManifest>(path.join(REPOSITORY_ROOT, "contracts/l3/game/manifest_madara.json")),
  ]);
  const systems = resolveSystemAddresses(manifest);
  assertChainId(chainId, "madara", "RPC_URL");
  const ledgerEnvironment = options.ledger ? resolveLedgerEnvironment() : undefined;
  const ledgerIdentities = options.ledger
    ? await loadLedgerBotIdentities(path.resolve(REPOSITORY_ROOT, options.ledgerAccountsPath!), options.bots)
    : undefined;
  const games = await resolveHarnessGames(options, ledgerEnvironment);
  const setupTransactions: TrackedTransaction[] = [];
  const gameRuns: PreparedGameRun[] = [];

  for (const [gameIndex, game] of games.entries()) {
    gameRuns.push(
      await prepareGameRun({
        game,
        gameIndex,
        gameplayContracts,
        ledgerEnvironment,
        ledgerIdentities,
        options,
        provider,
        setupTransactions,
        systems,
      }),
    );
  }

  const evidenceBefore = await collectHarnessEvidenceBeforeRun();
  console.log("Waiting until every bot has explorer stamina for its first action, then starting the measured workload");
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
    heraldUrl: options.heraldUrl,
  });

  const valuePlane = await finalizeValuePlaneRun({
    gameRuns,
    ledgerEnvironment,
    options,
    provider,
    systems,
  });

  const evidence = await finishHarnessEvidence(evidenceBefore, workload.startedAt, workload.endedAt);
  const minimumThresholdActions = resolveMinimumThresholdActions(options, workload.plannedActions);
  const report = await writeHarnessReport({
    accounts: gameRuns.flatMap(({ accounts }) => accounts),
    botCount: options.bots * options.games,
    chainId,
    evidence,
    games: games.map((game) => ({ ...game, botCount: options.bots })),
    intervalSeconds: options.intervalSeconds,
    minimumThresholdActions,
    minutes: options.minutes,
    rpcUrl: options.rpcUrl,
    setupTransactions,
    heraldUrl: options.heraldUrl,
    workload,
    valuePlane,
  });

  console.log(`${report.passed ? "PASS" : "FAIL"}: ${report.path}`);
  if (!report.passed) process.exitCode = 1;
}

export const createHarnessProvider = (rpcUrl: string): RpcProvider =>
  new RpcProvider({ blockIdentifier: BlockTag.PRE_CONFIRMED, nodeUrl: rpcUrl });

async function resolveHarnessGames(
  options: HarnessCliOptions,
  ledgerEnvironment?: LedgerEnvironment,
): Promise<HarnessGame[]> {
  if (options.gameId !== undefined) {
    return [{ gameId: options.gameId, gameName: options.gameName! }];
  }

  const baseName = options.gameName ?? `lab-${Date.now().toString(36)}`;
  const games: HarnessGame[] = [];
  for (let index = 0; index < options.games; index += 1) {
    const gameName = options.games === 1 ? baseName : `${baseName}-g${index + 1}`;
    const startAt = Math.floor(Date.now() / 1_000) + (options.ledger ? options.ledgerStartDelaySeconds : 60);
    const summary = await launchGame({
      accountAddress: process.env.DOJO_ACCOUNT_ADDRESS ?? MADARA_ADMIN_ADDRESS,
      devModeOn: !options.ledger,
      durationSeconds: Math.ceil(options.minutes * 60) + (options.ledger ? 300 : 3_600),
      environmentId: "madara.blitz",
      gameName,
      ledgerAddress: ledgerEnvironment?.ledgerAddress,
      ledgerRpcUrl: ledgerEnvironment?.mainnetRpcUrl,
      lordsAddress: ledgerEnvironment?.lordsAddress,
      pointRegistrationGraceSeconds: options.ledger ? 5 : undefined,
      privateKey: process.env.DOJO_PRIVATE_KEY ?? MADARA_ADMIN_PRIVATE_KEY,
      rpcUrl: options.rpcUrl,
      startTime: startAt,
      version: "6", // preset 6 (official-60) — the lab default we play; 96-player cap comes from the madara env
    });
    if (!summary.gameId) throw new Error(`Registrar did not return a game id for ${gameName}`);
    games.push({ gameId: summary.gameId, gameName, startAt });
  }
  return games;
}

function resolveSystemAddresses(manifest: WorldManifest): HarnessSystemAddresses {
  return {
    blitzRealm: requireContract(manifest, "s2-blitz_realm_systems"),
    prizeDistribution: requireContract(manifest, "s2-prize_distribution_systems"),
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

function resolveMinimumThresholdActions(options: HarnessCliOptions, plannedActions: number): number {
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
    if (name === "help" || name === "ledger") {
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

async function prepareGameRun({
  game,
  gameIndex,
  gameplayContracts,
  ledgerEnvironment,
  ledgerIdentities,
  options,
  provider,
  setupTransactions,
  systems,
}: {
  game: HarnessGame;
  gameIndex: number;
  gameplayContracts: GameplayContractsArtifact;
  ledgerEnvironment?: LedgerEnvironment;
  ledgerIdentities?: LedgerBotIdentity[];
  options: HarnessCliOptions;
  provider: RpcProvider;
  setupTransactions: TrackedTransaction[];
  systems: HarnessSystemAddresses;
}): Promise<PreparedGameRun> {
  const ledger =
    ledgerEnvironment && ledgerIdentities
      ? await prepareLedgerRegistrations(game, ledgerIdentities, ledgerEnvironment, options)
      : undefined;
  console.log(
    `Deploying ${options.bots} ${ledger ? "owner-bound" : "guest"} gameplay accounts for game ${game.gameId} (${game.gameName})`,
  );
  const accounts = await createHarnessAccounts({
    authority: gameplayContracts.bindingAuthorityAddress,
    botIdOffset: gameIndex * options.bots,
    classHash: gameplayContracts.playerAccountClassHash,
    concurrency: options.setupConcurrency,
    count: options.bots,
    gameId: game.gameId,
    identities: ledger ? toHarnessGameplayIdentities(ledgerIdentities) : undefined,
    provider,
  });

  let binding: LedgerHarnessEvidence["binding"] | undefined;
  if (ledger && ledgerEnvironment) {
    console.log(`Binding ${accounts.length} gameplay accounts to their mainnet owners`);
    binding = await bindLedgerGameplayAccounts({
      accounts,
      authorityAddress: gameplayContracts.bindingAuthorityAddress,
      authorityPrivateKey: ledgerEnvironment.authorityPrivateKey,
      playerRegistryAddress: gameplayContracts.playerRegistryAddress,
      provider,
    });
    console.log(`Waiting for ${accounts.length} mainnet registrations to reach the L3 fold`);
    await waitForRelayedLedgerRegistrations(
      options.heraldUrl,
      game.gameId,
      ledgerIdentities.map(({ mainnetAddress }) => mainnetAddress),
    );
  }

  console.log(`Settling, provisioning, and creating three explorers per bot for game ${game.gameId}`);
  const bots = await prepareHarnessBots({
    accounts,
    beforeProvision:
      ledger && game.startAt
        ? async () => {
            console.log(`All bots settled; waiting for game ${game.gameId} to start at ${game.startAt}`);
            await waitForGameStart(provider, game.startAt!);
          }
        : undefined,
    gameId: game.gameId,
    provider,
    setupConcurrency: options.setupConcurrency,
    setupTransactions,
    systems,
    heraldUrl: options.heraldUrl,
  });
  return {
    accounts,
    bots,
    game,
    ledger: ledger && binding ? { binding, registration: ledger.evidence, registrations: ledger.registrations } : undefined,
  };
}

async function prepareLedgerRegistrations(
  game: HarnessGame,
  identities: LedgerBotIdentity[],
  environment: LedgerEnvironment,
  options: HarnessCliOptions,
) {
  console.log(`Funding and registering ${identities.length} bot owners through the mainnet ledger`);
  return registerLedgerBots({
    concurrency: options.setupConcurrency,
    gameId: game.gameId,
    identities,
    ledgerAddress: environment.ledgerAddress,
    lordsAddress: environment.lordsAddress,
    mainnetRpcUrl: environment.mainnetRpcUrl,
    recoveryManifestPath: createLedgerSweepManifestPath(game.gameId),
    treasuryAddress: environment.treasuryAddress,
    treasuryPrivateKey: environment.treasuryPrivateKey,
  });
}

async function runLedgerSweepOnly(options: HarnessCliOptions): Promise<void> {
  const manifestPath = path.resolve(REPOSITORY_ROOT, options.sweepOnlyManifestPath!);
  const manifest = await readLedgerSweepManifest(manifestPath);
  const environment = resolveLedgerSweepEnvironment();
  assertSameAddress(manifest.lordsAddress, environment.lordsAddress, "LORDS_ADDRESS");
  assertSameAddress(manifest.treasuryAddress, environment.treasuryAddress, "LEDGER_TREASURY_ADDRESS");

  const identities = await loadLedgerBotIdentities(
    path.resolve(REPOSITORY_ROOT, options.ledgerAccountsPath!),
    manifest.accounts.length,
  );
  const identityByOwner = new Map(identities.map((identity) => [BigInt(identity.mainnetAddress).toString(), identity]));
  const provider = new RpcProvider({ nodeUrl: environment.mainnetRpcUrl });
  await assertProviderChain(provider, "mainnet", "LEDGER_RPC_URL");

  const accounts = manifest.accounts.map(({ owner, preFundLordsBalanceBaseUnits }) => {
    const identity = identityByOwner.get(BigInt(owner).toString());
    if (!identity) throw new Error(`--ledger-accounts is missing sweep owner ${owner}`);
    return {
      account: new Account({ provider, address: identity.mainnetAddress, signer: identity.mainnetPrivateKey }),
      owner,
      preFundLordsBalance: BigInt(preFundLordsBalanceBaseUnits),
    };
  });
  if (accounts.length !== identityByOwner.size) {
    throw new Error("--ledger-accounts contains an owner absent from the sweep manifest");
  }

  const evidence = await sweepLedgerBalances(
    provider,
    accounts,
    environment.lordsAddress,
    options.setupConcurrency,
    environment.treasuryAddress,
  );
  const receiptPath = await writeLedgerSweepReceipt(manifestPath, evidence);
  console.log(
    JSON.stringify({
      amountBaseUnits: evidence.amount.toString(),
      receiptPath,
      transactionHashes: evidence.transactionHashes,
    }),
  );
}

async function finalizeValuePlaneRun({
  gameRuns,
  ledgerEnvironment,
  options,
  provider,
  systems,
}: {
  gameRuns: PreparedGameRun[];
  ledgerEnvironment?: LedgerEnvironment;
  options: HarnessCliOptions;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
}): Promise<LedgerHarnessEvidence | undefined> {
  const run = gameRuns[0];
  if (!run?.ledger || !ledgerEnvironment) return undefined;
  console.log(`Waiting for game ${run.game.gameId} to close, then publishing its competition ranking`);
  const finalization = await finalizeLedgerGame({
    account: run.accounts[0]!.account,
    concurrency: options.setupConcurrency,
    gameId: run.game.gameId,
    heraldUrl: options.heraldUrl,
    ledgerAddress: ledgerEnvironment.ledgerAddress,
    lordsAddress: ledgerEnvironment.lordsAddress,
    mainnetRpcUrl: ledgerEnvironment.mainnetRpcUrl,
    provider,
    rankingSystemAddress: systems.prizeDistribution,
    registrations: run.ledger.registrations,
    sweepManifestPath: run.ledger.registration.sweepManifestPath,
    treasuryAddress: ledgerEnvironment.treasuryAddress,
  });
  return {
    binding: run.ledger.binding,
    finalization,
    ledgerAddress: ledgerEnvironment.ledgerAddress,
    lordsAddress: ledgerEnvironment.lordsAddress,
    mode: "ledger",
    registration: run.ledger.registration,
  };
}

function resolveLedgerEnvironment(): LedgerEnvironment {
  return {
    authorityPrivateKey: requiredEnvironmentValue("BINDING_AUTHORITY_PRIVATE_KEY"),
    ledgerAddress: requiredEnvironmentValue("LEDGER_ADDRESS"),
    lordsAddress: requiredEnvironmentValue("LORDS_ADDRESS"),
    mainnetRpcUrl: requiredEnvironmentValue("LEDGER_RPC_URL"),
    treasuryAddress: requiredEnvironmentValue("LEDGER_TREASURY_ADDRESS"),
    treasuryPrivateKey: requiredEnvironmentValue("LEDGER_TREASURY_PRIVATE_KEY"),
  };
}

function resolveLedgerSweepEnvironment(): LedgerSweepEnvironment {
  return {
    lordsAddress: requiredEnvironmentValue("LORDS_ADDRESS", "--sweep-only"),
    mainnetRpcUrl: requiredEnvironmentValue("LEDGER_RPC_URL", "--sweep-only"),
    treasuryAddress: requiredEnvironmentValue("LEDGER_TREASURY_ADDRESS", "--sweep-only"),
  };
}

function requiredEnvironmentValue(name: string, mode = "--ledger"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required with ${mode}`);
  return value;
}

function createLedgerSweepManifestPath(gameId: number): string {
  const runId = new Date().toISOString().replace(/[-:.]/g, "");
  return path.join(LAB_DIRECTORY, `.lab/runs/${runId}-game-${gameId}.sweep.json`);
}

function assertSameAddress(actual: string, expected: string, environmentName: string): void {
  if (BigInt(actual) !== BigInt(expected)) {
    throw new Error(`${environmentName} ${expected} does not match sweep manifest address ${actual}`);
  }
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
  --herald-url <url>             default: ${DEFAULT_HERALD_URL}
  --ledger                       use mainnet ledger registration and result settlement
  --ledger-accounts <path>       JSON array of mainnet bot and gameplay keys; required with --ledger
  --ledger-start-delay-seconds   registration window before play; default: 900
  --sweep-only <manifest>        recover LORDS above the manifest's pre-fund baselines, then exit
`);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
