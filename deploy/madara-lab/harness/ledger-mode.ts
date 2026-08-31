import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import {
  Account,
  CallData,
  RpcProvider,
  constants,
  ec,
  uint256,
  validateAndParseAddress,
  type Call,
} from "starknet";
import { resolveGameTransactionResourceBounds } from "../../../packages/core/src/account/transaction-resource-bounds";
import { decodeGameLedgerGame } from "../../../packages/core/src/data/abi/GameLedger";
import {
  mapWithConcurrency,
  type HarnessAccount,
  type HarnessGameplayIdentity,
} from "./account-factory";
import { HeraldObserver } from "./herald-observer";
import {
  assertLedgerRunConservation,
  executeMainnetAndWait,
  readLedgerBalanceBaselines,
  readTokenBalance,
  sweepLedgerBalances,
  writeLedgerSweepManifest,
  type LedgerBalanceBaseline,
} from "./ledger-money";

export interface LedgerBotIdentity {
  gameplayPrivateKey: string;
  mainnetAddress: string;
  mainnetPrivateKey: string;
  shield: boolean;
  sword: boolean;
}

export interface LedgerRegistrationRuntime {
  account: Account;
  identity: LedgerBotIdentity;
  payment: bigint;
  preFundLordsBalance: bigint;
  strkBalance: bigint;
}

export interface LedgerRegistrationEvidence {
  fundingTransactionHashes: string[];
  mainnetChainId: string;
  registrations: Array<{
    owner: string;
    paymentBaseUnits: string;
    preFundLordsBalanceBaseUnits: string;
    shield: boolean;
    strkBalanceBaseUnits: string;
    sword: boolean;
    transactionHash: string;
  }>;
  requiredTreasuryFloatBaseUnits: string;
  sweepManifestPath: string;
}

export interface LedgerBindingEvidence {
  alreadyBound: number;
  bindingTransactionHashes: string[];
}

export interface LedgerFinalizationEvidence {
  dustBaseUnits: string;
  protocolCutBaseUnits: string;
  rankingTransactionHash: string;
  returnedToTreasuryBaseUnits: string;
  sweptLordsBaseUnits: string;
  sweepTransactionHashes: string[];
  trialId: string;
}

export interface LedgerHarnessEvidence {
  binding: LedgerBindingEvidence;
  finalization: LedgerFinalizationEvidence;
  ledgerAddress: string;
  lordsAddress: string;
  mode: "ledger";
  registration: LedgerRegistrationEvidence;
}

interface RegisterLedgerBotsOptions {
  concurrency: number;
  gameId: number;
  identities: readonly LedgerBotIdentity[];
  ledgerAddress: string;
  lordsAddress: string;
  mainnetRpcUrl: string;
  recoveryManifestPath: string;
  treasuryAddress: string;
  treasuryPrivateKey: string;
}

interface BindLedgerGameplayAccountsOptions {
  accounts: readonly HarnessAccount[];
  authorityAddress: string;
  authorityPrivateKey: string;
  playerRegistryAddress: string;
  provider: RpcProvider;
}

interface FinalizeLedgerGameOptions {
  account: Account;
  gameId: number;
  heraldUrl: string;
  mainnetRpcUrl: string;
  ledgerAddress: string;
  provider: RpcProvider;
  rankingSystemAddress: string;
  registrations: readonly LedgerRegistrationRuntime[];
  lordsAddress: string;
  concurrency: number;
  treasuryAddress: string;
}

interface LedgerPresetCosts {
  entryFee: bigint;
  shieldPrice: bigint;
  swordPrice: bigint;
}

const MADARA_RESOURCE_BOUNDS = resolveGameTransactionResourceBounds("madara");
const MADARA_RECEIPT_POLL_MS = 50;
const FUNDING_BATCH_SIZE = 12;
const BINDING_BATCH_SIZE = 24;
const RELAY_TIMEOUT_MS = 15 * 60 * 1_000;
const FINALIZATION_TIMEOUT_MS = 15 * 60 * 1_000;

export async function loadLedgerBotIdentities(filePath: string, expectedCount: number): Promise<LedgerBotIdentity[]> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  return parseLedgerBotIdentities(parsed, expectedCount);
}

export function parseLedgerBotIdentities(parsed: unknown, expectedCount: number): LedgerBotIdentity[] {
  if (!Array.isArray(parsed)) throw new Error("--ledger-accounts must contain a JSON array");
  if (parsed.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ledger bot identities, received ${parsed.length}`);
  }

  const identities = parsed.map((value, index) => parseLedgerBotIdentity(value, index));
  assertUnique(identities.map(({ mainnetAddress }) => mainnetAddress), "mainnet address");
  assertUnique(
    identities.map(({ gameplayPrivateKey }) => ec.starkCurve.getStarkKey(gameplayPrivateKey)),
    "gameplay public key",
  );
  return identities;
}

export function toHarnessGameplayIdentities(
  identities: readonly LedgerBotIdentity[],
): HarnessGameplayIdentity[] {
  return identities.map(({ gameplayPrivateKey, mainnetAddress }) => ({
    owner: mainnetAddress,
    privateKey: gameplayPrivateKey,
  }));
}

export async function registerLedgerBots(
  options: RegisterLedgerBotsOptions,
): Promise<{ evidence: LedgerRegistrationEvidence; registrations: LedgerRegistrationRuntime[] }> {
  const provider = new RpcProvider({ nodeUrl: options.mainnetRpcUrl });
  const mainnetChainId = await provider.getChainId();
  if (BigInt(mainnetChainId) !== BigInt(constants.StarknetChainId.SN_MAIN)) {
    throw new Error(`Ledger harness requires Starknet mainnet, received ${mainnetChainId}`);
  }

  const game = await readLedgerGame(provider, options.ledgerAddress, options.gameId);
  const latestBlock = await provider.getBlock("latest");
  assertGameAcceptsRegistrations(game, options.gameId, Number(latestBlock.timestamp));
  const costs = await readLedgerPresetCosts(provider, options.ledgerAddress, game.presetId);
  const baselines = await readLedgerBalanceBaselines(
    provider,
    options.lordsAddress,
    options.identities.map(({ mainnetAddress }) => mainnetAddress),
    options.concurrency,
  );
  const registrations = await prepareRegistrationAccounts(provider, options, costs, baselines);
  const requiredTreasuryFloat = registrations.reduce((total, registration) => total + registration.payment, 0n);
  await writeLedgerSweepManifest(options.recoveryManifestPath, {
    accounts: baselines,
    chainId: mainnetChainId,
    gameId: options.gameId,
    ledgerAddress: options.ledgerAddress,
    lordsAddress: options.lordsAddress,
    treasuryAddress: options.treasuryAddress,
  });
  console.log(`Ledger sweep manifest written before treasury funding: ${options.recoveryManifestPath}`);
  const treasury = new Account({
    provider,
    address: options.treasuryAddress,
    signer: options.treasuryPrivateKey,
  });

  const fundingTransactionHashes = await fundRegistrations(
    provider,
    treasury,
    options.lordsAddress,
    registrations,
    requiredTreasuryFloat,
  );
  const registrationTransactionHashes = await submitRegistrations(
    registrations,
    options.ledgerAddress,
    options.lordsAddress,
    options.gameId,
    options.concurrency,
  );

  return {
    registrations,
    evidence: {
      fundingTransactionHashes,
      mainnetChainId,
      registrations: registrations.map(({ identity, payment, preFundLordsBalance, strkBalance }, index) => ({
        owner: identity.mainnetAddress,
        paymentBaseUnits: payment.toString(),
        preFundLordsBalanceBaseUnits: preFundLordsBalance.toString(),
        shield: identity.shield,
        strkBalanceBaseUnits: strkBalance.toString(),
        sword: identity.sword,
        transactionHash: registrationTransactionHashes[index]!,
      })),
      requiredTreasuryFloatBaseUnits: requiredTreasuryFloat.toString(),
      sweepManifestPath: options.recoveryManifestPath,
    },
  };
}

export async function bindLedgerGameplayAccounts(
  options: BindLedgerGameplayAccountsOptions,
): Promise<LedgerBindingEvidence> {
  const calls: Call[] = [];
  let alreadyBound = 0;

  for (const account of options.accounts) {
    const [boundAccount, boundOwner] = await Promise.all([
      readRegistryAddress(options.provider, options.playerRegistryAddress, "account_of", account.owner),
      readRegistryAddress(options.provider, options.playerRegistryAddress, "owner_of", account.address),
    ]);
    if (sameAddress(boundAccount, account.address) && sameAddress(boundOwner, account.owner)) {
      alreadyBound += 1;
      continue;
    }
    if (BigInt(boundAccount) !== 0n || BigInt(boundOwner) !== 0n) {
      throw new Error(
        `PlayerRegistry binding conflict for owner ${account.owner}: account_of=${boundAccount}, owner_of(${account.address})=${boundOwner}`,
      );
    }
    calls.push({
      contractAddress: options.playerRegistryAddress,
      entrypoint: "bind",
      calldata: CallData.compile([account.owner, account.address]),
    });
  }

  const authority = new Account({
    provider: options.provider,
    address: options.authorityAddress,
    signer: options.authorityPrivateKey,
  });
  const bindingTransactionHashes: string[] = [];
  for (const batch of chunk(calls, BINDING_BATCH_SIZE)) {
    bindingTransactionHashes.push(await executeMadaraAndWait(authority, batch, "bind gameplay accounts"));
  }
  return { alreadyBound, bindingTransactionHashes };
}

export async function waitForRelayedLedgerRegistrations(
  heraldUrl: string,
  gameId: number,
  owners: readonly string[],
): Promise<void> {
  const expectedOwners = new Set(owners.map(normalizeFelt));
  const observer = new HeraldObserver(heraldUrl, "madara");
  await observer.waitForModelRows(
    gameId,
    ["LedgerRegistration"],
    (models) => {
      const relayedOwners = new Set(
        models
          .get("LedgerRegistration")!
          .filter((row) => truthyFelt(row.registered))
          .map((row) => normalizeFelt(row.owner)),
      );
      return relayedOwners.size === expectedOwners.size && [...expectedOwners].every((owner) => relayedOwners.has(owner));
    },
    RELAY_TIMEOUT_MS,
  );
}

export async function waitForGameStart(provider: RpcProvider, startAt: number): Promise<void> {
  await waitForChainTimestamp(provider, startAt, Math.max(120_000, (startAt - Math.floor(Date.now() / 1_000)) * 1_000 + 120_000));
}

export async function finalizeLedgerGame(options: FinalizeLedgerGameOptions): Promise<LedgerFinalizationEvidence> {
  const observer = new HeraldObserver(options.heraldUrl, "madara");
  const schedule = await readGameSchedule(observer, options.gameId);
  await waitForChainTimestamp(
    options.provider,
    schedule.endAt + schedule.registrationGraceSeconds + 1,
    Math.max(120_000, (schedule.endAt + schedule.registrationGraceSeconds - Math.floor(Date.now() / 1_000)) * 1_000 + 120_000),
  );

  const players = await readRankedPlayers(observer, options.gameId);
  if (players.length !== options.registrations.length) {
    throw new Error(
      `Result roster has ${players.length} players; ledger mode registered ${options.registrations.length}`,
    );
  }
  const trialId = randomTrialId();
  const rankingTransactionHash = await executeMadaraAndWait(
    options.account,
    {
      contractAddress: options.rankingSystemAddress,
      entrypoint: "blitz_prize_player_rank",
      calldata: [
        options.gameId.toString(),
        trialId.toString(),
        players.length.toString(),
        players.length.toString(),
        ...players,
      ],
    },
    `finalize game ${options.gameId} ranking`,
  );

  await observer.waitForModelRows(
    options.gameId,
    ["GameRegistry"],
    (models) => models.get("GameRegistry")!.some((row) => BigInt(row.final_trial_id as string) === trialId),
    120_000,
  );
  const mainnetProvider = new RpcProvider({ nodeUrl: options.mainnetRpcUrl });
  const finalized = await waitForLedgerFinalization(mainnetProvider, options.ledgerAddress, options.gameId);
  const sweep = await sweepLedgerBalances(
    mainnetProvider,
    options.registrations.map(({ account, identity, preFundLordsBalance }) => ({
      account,
      owner: identity.mainnetAddress,
      preFundLordsBalance,
    })),
    options.lordsAddress,
    options.concurrency,
    options.treasuryAddress,
  );
  const returnedToTreasury = assertLedgerRunConservation({
    dust: finalized.dust,
    funded: options.registrations.reduce((total, registration) => total + registration.payment, 0n),
    protocolCut: finalized.protocolCut,
    swept: sweep.amount,
  });

  return {
    dustBaseUnits: finalized.dust.toString(),
    protocolCutBaseUnits: finalized.protocolCut.toString(),
    rankingTransactionHash,
    returnedToTreasuryBaseUnits: returnedToTreasury.toString(),
    sweptLordsBaseUnits: sweep.amount.toString(),
    sweepTransactionHashes: sweep.transactionHashes,
    trialId: trialId.toString(),
  };
}

function parseLedgerBotIdentity(value: unknown, index: number): LedgerBotIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Ledger bot identity ${index} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const mainnetAddress = parseAddress(record.mainnetAddress, `ledger bot identity ${index}.mainnetAddress`);
  const mainnetPrivateKey = parsePrivateKey(record.mainnetPrivateKey, `ledger bot identity ${index}.mainnetPrivateKey`);
  const gameplayPrivateKey = parsePrivateKey(
    record.gameplayPrivateKey,
    `ledger bot identity ${index}.gameplayPrivateKey`,
  );
  return {
    gameplayPrivateKey,
    mainnetAddress,
    mainnetPrivateKey,
    shield: parseOptionalBoolean(record.shield, `ledger bot identity ${index}.shield`),
    sword: parseOptionalBoolean(record.sword, `ledger bot identity ${index}.sword`),
  };
}

function parseAddress(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a Starknet address`);
  try {
    if (BigInt(value) === 0n) throw new Error("zero");
    return validateAndParseAddress(value);
  } catch {
    throw new Error(`${label} must be a non-zero Starknet address`);
  }
}

function parsePrivateKey(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a Starknet private key`);
  try {
    if (BigInt(value) === 0n) throw new Error("zero");
    ec.starkCurve.getStarkKey(value);
    return value;
  } catch {
    throw new Error(`${label} must be a non-zero Starknet private key`);
  }
}

function parseOptionalBoolean(value: unknown, label: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeFelt(value);
    if (seen.has(normalized)) throw new Error(`Ledger bot identities contain a duplicate ${label}: ${value}`);
    seen.add(normalized);
  }
}

async function prepareRegistrationAccounts(
  provider: RpcProvider,
  options: RegisterLedgerBotsOptions,
  costs: LedgerPresetCosts,
  baselines: readonly LedgerBalanceBaseline[],
): Promise<LedgerRegistrationRuntime[]> {
  const baselineByOwner = new Map(baselines.map((baseline) => [normalizeFelt(baseline.owner), baseline]));
  return mapWithConcurrency(options.identities, options.concurrency, async (identity) => {
    await provider.getClassHashAt(identity.mainnetAddress);
    const registered = await readLedgerRegistration(provider, options.ledgerAddress, options.gameId, identity.mainnetAddress);
    if (registered) throw new Error(`Owner ${identity.mainnetAddress} is already registered for game ${options.gameId}`);
    const payment =
      costs.entryFee + (identity.sword ? costs.swordPrice : 0n) + (identity.shield ? costs.shieldPrice : 0n);
    const baseline = baselineByOwner.get(normalizeFelt(identity.mainnetAddress));
    if (!baseline) throw new Error(`Missing balance baseline for owner ${identity.mainnetAddress}`);
    return {
      account: new Account({ provider, address: identity.mainnetAddress, signer: identity.mainnetPrivateKey }),
      identity,
      payment,
      preFundLordsBalance: baseline.preFundLordsBalance,
      strkBalance: baseline.strkBalance,
    };
  });
}

async function fundRegistrations(
  provider: RpcProvider,
  treasury: Account,
  lordsAddress: string,
  registrations: readonly LedgerRegistrationRuntime[],
  requiredTreasuryFloat: bigint,
): Promise<string[]> {
  if (requiredTreasuryFloat === 0n) return [];
  const treasuryBalance = await readTokenBalance(provider, lordsAddress, treasury.address);
  if (treasuryBalance < requiredTreasuryFloat) {
    throw new Error(
      `Ledger treasury needs ${requiredTreasuryFloat} LORDS base units for the bot float, balance is ${treasuryBalance}`,
    );
  }

  const calls = registrations.flatMap(({ identity, payment }) =>
    payment === 0n
      ? []
      : [
          {
            contractAddress: lordsAddress,
            entrypoint: "transfer",
            calldata: CallData.compile([identity.mainnetAddress, uint256.bnToUint256(payment)]),
          },
        ],
  );
  const transactionHashes: string[] = [];
  for (const batch of chunk(calls, FUNDING_BATCH_SIZE)) {
    transactionHashes.push(await executeMainnetAndWait(treasury, batch, "fund ledger bot registrations"));
  }
  return transactionHashes;
}

async function submitRegistrations(
  registrations: readonly LedgerRegistrationRuntime[],
  ledgerAddress: string,
  lordsAddress: string,
  gameId: number,
  concurrency: number,
): Promise<string[]> {
  return mapWithConcurrency(registrations, concurrency, async ({ account, identity, payment }) => {
    const calls: Call[] = [];
    if (payment > 0n) {
      calls.push({
        contractAddress: lordsAddress,
        entrypoint: "approve",
        calldata: CallData.compile([ledgerAddress, uint256.bnToUint256(payment)]),
      });
    }
    calls.push({
      contractAddress: ledgerAddress,
      entrypoint: "register",
      calldata: CallData.compile([gameId, identity.sword, identity.shield]),
    });
    return executeMainnetAndWait(account, calls, `register ${identity.mainnetAddress} for ledger game ${gameId}`);
  });
}

async function readLedgerGame(provider: RpcProvider, ledgerAddress: string, gameId: number) {
  const result = await provider.callContract(
    { contractAddress: ledgerAddress, entrypoint: "get_game", calldata: [gameId.toString()] },
    "latest",
  );
  return decodeGameLedgerGame(result);
}

function assertGameAcceptsRegistrations(
  game: ReturnType<typeof decodeGameLedgerGame>,
  gameId: number,
  chainTimestamp: number,
): void {
  if (game.cancelled) throw new Error(`Ledger game ${gameId} is cancelled`);
  if (game.finalized) throw new Error(`Ledger game ${gameId} is already finalized`);
  if (chainTimestamp >= game.start) throw new Error(`Ledger game ${gameId} registration is closed`);
}

async function readLedgerPresetCosts(
  provider: RpcProvider,
  ledgerAddress: string,
  presetId: number,
): Promise<LedgerPresetCosts> {
  const result = await provider.callContract(
    { contractAddress: ledgerAddress, entrypoint: "get_preset", calldata: [presetId.toString()] },
    "latest",
  );
  return {
    entryFee: readUint256(result, 0),
    swordPrice: readUint256(result, 5),
    shieldPrice: readUint256(result, 7),
  };
}

async function readLedgerRegistration(
  provider: RpcProvider,
  ledgerAddress: string,
  gameId: number,
  owner: string,
): Promise<boolean> {
  const result = await provider.callContract(
    { contractAddress: ledgerAddress, entrypoint: "get_registration", calldata: [gameId.toString(), owner] },
    "latest",
  );
  return truthyFelt(result[0]);
}

async function readRegistryAddress(
  provider: RpcProvider,
  registry: string,
  entrypoint: "account_of" | "owner_of",
  address: string,
): Promise<string> {
  const result = await provider.callContract({ contractAddress: registry, entrypoint, calldata: [address] }, "latest");
  return validateAndParseAddress(result[0] ?? "0x0");
}

async function readGameSchedule(observer: HeraldObserver, gameId: number) {
  const rows = await observer.readModelRows(gameId, ["GameRegistry"]);
  const game = rows.get("GameRegistry")![0];
  if (!game) throw new Error(`GameRegistry ${gameId} is absent from Herald`);
  return {
    endAt: safeNumber(game.end_at, "GameRegistry.end_at"),
    registrationGraceSeconds: safeNumber(
      game.registration_grace_seconds,
      "GameRegistry.registration_grace_seconds",
    ),
  };
}

async function readRankedPlayers(observer: HeraldObserver, gameId: number): Promise<string[]> {
  const rows = await observer.readModelRows(gameId, ["BlitzSettlement", "PlayerRegisteredPoints"]);
  return rankPlayersByRegisteredPoints(rows.get("BlitzSettlement")!, rows.get("PlayerRegisteredPoints")!);
}

export function rankPlayersByRegisteredPoints(
  settlements: readonly Record<string, unknown>[],
  registeredPoints: readonly Record<string, unknown>[],
): string[] {
  const points = new Map(
    registeredPoints.map((row) => [normalizeFelt(row.address), BigInt(row.registered_points as string)]),
  );
  return settlements
    .map((row) => normalizeAddress(row.player, "BlitzSettlement.player"))
    .filter((address, index, all) => all.findIndex((candidate) => sameAddress(candidate, address)) === index)
    .map((address) => ({ address, points: points.get(normalizeFelt(address)) ?? 0n }))
    .toSorted((left, right) => {
      if (left.points !== right.points) return left.points > right.points ? -1 : 1;
      const leftAddress = BigInt(left.address);
      const rightAddress = BigInt(right.address);
      return leftAddress < rightAddress ? -1 : leftAddress > rightAddress ? 1 : 0;
    })
    .map(({ address }) => address);
}

async function waitForLedgerFinalization(
  provider: RpcProvider,
  ledgerAddress: string,
  gameId: number,
): Promise<LedgerGame> {
  const deadline = Date.now() + FINALIZATION_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const game = await readLedgerGame(provider, ledgerAddress, gameId);
    if (game.finalized) {
      if (game.pool !== 0n) throw new Error(`Finalized ledger game ${gameId} retains pool ${game.pool}`);
      return game;
    }
    await sleep(2_000);
  }
  throw new Error(`Operator did not finalize ledger game ${gameId} within ${FINALIZATION_TIMEOUT_MS / 1_000} seconds`);
}

async function waitForChainTimestamp(provider: RpcProvider, target: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const block = await provider.getBlock("latest");
    if (Number(block.timestamp) >= target) return;
    await sleep(1_000);
  }
  throw new Error(`Chain timestamp did not reach ${target} within ${Math.ceil(timeoutMs / 1_000)} seconds`);
}

async function executeMadaraAndWait(account: Account, calls: Call | Call[], label: string): Promise<string> {
  const transaction = await account.execute(calls, { resourceBounds: MADARA_RESOURCE_BOUNDS, tip: 0 });
  return waitForSuccessfulTransaction(account, transaction.transaction_hash, label, MADARA_RECEIPT_POLL_MS);
}

async function waitForSuccessfulTransaction(
  account: Account,
  transactionHash: string,
  label: string,
  retryInterval: number,
): Promise<string> {
  const receipt = await account.waitForTransaction(transactionHash, { retryInterval });
  const status = receipt as { execution_status?: string; isSuccess?: () => boolean };
  const succeeded = typeof status.isSuccess === "function" ? status.isSuccess() : status.execution_status === "SUCCEEDED";
  if (!succeeded) throw new Error(`${label} failed for transaction ${transactionHash}`);
  return transactionHash;
}

function readUint256(values: readonly string[], index: number): bigint {
  return uint256.uint256ToBN({ low: values[index] ?? "0", high: values[index + 1] ?? "0" });
}

function truthyFelt(value: unknown): boolean {
  return BigInt(value as string | number | bigint) !== 0n;
}

function normalizeFelt(value: unknown): string {
  return BigInt(value as string | number | bigint).toString();
}

function normalizeAddress(value: unknown, label: string): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`${label} must be a Starknet address`);
  }
  return validateAndParseAddress(`0x${BigInt(value).toString(16)}`);
}

function sameAddress(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}

function safeNumber(value: unknown, label: string): number {
  const parsed = Number(BigInt(value as string | number | bigint));
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} must be a safe integer`);
  return parsed;
}

function randomTrialId(): bigint {
  const value = BigInt(`0x${randomBytes(16).toString("hex")}`);
  return value === 0n ? 1n : value;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}
