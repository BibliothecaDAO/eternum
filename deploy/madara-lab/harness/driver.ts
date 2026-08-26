import { setTimeout as sleep } from "node:timers/promises";
import { CallData, shortString, type Account, type Call, type ResourceBoundsBN, type RpcProvider } from "starknet";
import { buildBlitzSettleCalls } from "../../../apps/game/src/services/blitz/blitz-settlement-calls";
import { mapWithConcurrency, type HarnessAccount } from "./account-factory";
import { queryTorii, ToriiObserver, type IndexedExplorer as ExplorerRow } from "./torii-observer";

export type WorkloadActionKind = "move" | "explore" | "produce";
export type TransactionStage = "setup" | "workload";
export type MeasuredRpcMethod = "estimateInvokeFee" | "getBlock" | "getTransactionStatus";
export type TransactionOutcome =
  | "completed"
  | "reverted"
  | "rejected"
  | "submit_failed"
  | "confirmation_timeout"
  | "index_timeout"
  | "driver_failed";

export interface RpcMethodMetrics {
  calls: number;
  wallMs: number;
}

export type RpcMetrics = Record<MeasuredRpcMethod, RpcMethodMetrics>;

export interface ProductionDelta {
  laborBalance: string;
  laborDelta: string;
  woodOutput: string;
  woodOutputDelta: string;
}

export interface TrackedTransaction {
  acceptedOnL2At?: string;
  acceptedOnL2Ms?: number;
  actionIndex?: number;
  botId: number;
  error?: string;
  eventIndexedAt?: string;
  exploreRequested?: boolean;
  finalityStatus?: string;
  indexedAt?: string;
  indexedMs?: number;
  kind: string;
  outcome: TransactionOutcome;
  preConfirmedAt?: string;
  preConfirmedMs?: number;
  productionDelta?: ProductionDelta;
  rpc: RpcMetrics;
  scheduledAt?: string;
  stage: TransactionStage;
  submitDelayMs?: number;
  submitStartedAt: string;
  submittedAt?: string;
  submitMs?: number;
  tick?: number;
  transactionHash?: string;
  transactionIndexedAt?: string;
}

export interface HarnessSystemAddresses {
  blitzRealm: string;
  production: string;
  troopManagement: string;
  troopMovement: string;
}

export interface HarnessBot {
  account: Account;
  address: string;
  botId: number;
  explorers: ExplorerState[];
  nextProductionStructure: number;
  structures: StructureState[];
}

export interface WorkloadResult {
  actions: TrackedTransaction[];
  endedAt: string;
  plannedActions: number;
  overheadRpc: RpcMetrics;
  startedAt: string;
  ticks: number;
  warmupMs: number;
}

interface ExplorerState {
  atFrontier: boolean;
  blockedDirections: Map<string, Set<number>>;
  coord: Coord;
  explorerId: string;
  lastUsedAt: number;
  modelEventId: string;
  outwardDirection: number;
  pathDirections: number[];
  stamina: number;
  staminaUpdatedTick: number;
  structureId: string;
}

interface StructureState {
  coord: Coord;
  direction: number;
  structureId: string;
}

interface Coord {
  x: number;
  y: number;
}

interface ExplorerPriority {
  atFrontier: boolean;
  lastUsedAt: number;
}

interface PrepareHarnessBotsOptions {
  accounts: HarnessAccount[];
  gameId: number;
  provider: RpcProvider;
  setupConcurrency?: number;
  setupTransactions: TrackedTransaction[];
  systems: HarnessSystemAddresses;
  toriiSqlUrl: string;
}

interface RunWorkloadOptions {
  bots: HarnessBot[];
  gameId: number;
  intervalSeconds: number;
  minutes: number;
  onTick?: (completedTicks: number, totalTicks: number) => void;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
  toriiSqlUrl: string;
}

interface TrackTransactionOptions {
  account: Account;
  actionIndex?: number;
  botId: number;
  calls: Call | Call[];
  exploreRequested?: boolean;
  resourceBounds?: ResourceBoundsBN;
  kind: string;
  provider: RpcProvider;
  rpc?: RpcMetrics;
  scheduledAtMs?: number;
  stage: TransactionStage;
  tick?: number;
  toriiObserver: ToriiObserver;
}

const CENTER_COORD = 2_147_483_646;
const ARMY_TICK_SECONDS = 60;
const STAMINA_GAIN_PER_TICK = 30;
const STAMINA_MAX = 120;
const MAX_ACTION_STAMINA_COST = 30;
const EXPLORER_COUNT_PER_BOT = 3;
const EXPLORER_TROOP_AMOUNT = 10_000_000_000n;
const WOOD_RESOURCE_ID = 3;
export const RECEIPT_POLL_INTERVAL_MS = 50;
const TRANSACTION_TIMEOUT_MS = 30_000;
const SETUP_TRANSACTION_TIMEOUT_MS = 120_000;
const MODEL_UPDATE_TIMEOUT_MS = 30_000;
const STAMINA_WARMUP_TIMEOUT_MS = 360_000;
const STAMINA_WARMUP_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SETUP_CONCURRENCY = 6;
const RESOURCE_HEADROOM_MULTIPLIER = 2n;
const MAX_L2_GAS_AMOUNT = 1_200_000_000n;

// Ten actions give the exact requested 50/30/20 mix. Explorers are primed first so a travel action never targets
// the realm tile behind a freshly spawned troop.
const ACTION_PATTERN: readonly WorkloadActionKind[] = [
  "explore",
  "explore",
  "explore",
  "move",
  "move",
  "produce",
  "move",
  "move",
  "produce",
  "move",
];

export async function prepareHarnessBots({
  accounts,
  gameId,
  provider,
  setupConcurrency = DEFAULT_SETUP_CONCURRENCY,
  setupTransactions,
  systems,
  toriiSqlUrl,
}: PrepareHarnessBotsOptions): Promise<HarnessBot[]> {
  const mapCenter = await readMapCenter(toriiSqlUrl, gameId);
  const toriiObserver = new ToriiObserver(toriiSqlUrl);

  return mapWithConcurrency(accounts, setupConcurrency, async (harnessAccount) => {
    const settle = await settleBot({ harnessAccount, gameId, provider, systems, toriiObserver });
    setupTransactions.push(settle);
    assertCompleted(settle);

    const structureIds = await readSettlementStructureIds(toriiSqlUrl, gameId, harnessAccount.address);
    const structures = await readStructures(toriiSqlUrl, gameId, structureIds, mapCenter);

    const provision = await provisionBot({
      account: harnessAccount.account,
      botId: harnessAccount.botId,
      gameId,
      provider,
      structureIds,
      systems,
      toriiObserver,
    });
    setupTransactions.push(provision);
    assertCompleted(provision);

    const troopTypes = await readStartingTroopTypes(toriiSqlUrl, gameId, structureIds);

    const createExplorers = await createBotExplorers({
      account: harnessAccount.account,
      botId: harnessAccount.botId,
      gameId,
      provider,
      structures,
      systems,
      toriiObserver,
      troopTypes,
    });
    setupTransactions.push(createExplorers);
    assertCompleted(createExplorers);

    const explorerRows = await readExplorers(toriiSqlUrl, gameId, structureIds);
    const explorers = structures.map((structure) => buildExplorerState(structure, explorerRows));

    return {
      account: harnessAccount.account,
      address: harnessAccount.address,
      botId: harnessAccount.botId,
      explorers,
      nextProductionStructure: 0,
      structures,
    };
  });
}

export async function runWorkload({
  bots,
  gameId,
  intervalSeconds,
  minutes,
  onTick,
  provider,
  systems,
  toriiSqlUrl,
}: RunWorkloadOptions): Promise<WorkloadResult> {
  const ticks = Math.floor((minutes * 60) / intervalSeconds);
  const overheadRpc = createRpcMetrics();
  const warmupMs = await waitForAllExplorersToReachFullStamina(provider, bots, overheadRpc);

  const workloadStartedAtMs = Date.now();
  const actions: TrackedTransaction[] = [];
  const botQueues = bots.map(() => Promise.resolve());
  const botSpacingMs = (intervalSeconds * 1_000) / bots.length;
  const toriiObserver = new ToriiObserver(toriiSqlUrl);

  for (let tick = 0; tick < ticks; tick += 1) {
    for (const bot of bots) {
      const scheduledAtMs = workloadStartedAtMs + tick * intervalSeconds * 1_000 + bot.botId * botSpacingMs;
      await sleepUntil(scheduledAtMs);
      const actionIndex = tick * bots.length + bot.botId;
      botQueues[bot.botId] = botQueues[bot.botId]!.then(async () => {
        const rpc = createRpcMetrics();
        const chainTick = await readCurrentArmyTick(provider, rpc);
        const action = await runBotAction({
          actionIndex,
          bot,
          chainTick,
          gameId,
          kind: resolveActionKind(tick),
          provider,
          rpc,
          scheduledAtMs,
          systems,
          tick,
          toriiObserver,
        });
        actions.push(action);
      });
    }

    onTick?.(tick + 1, ticks);
  }

  await Promise.all(botQueues);
  actions.sort((left, right) => (left.actionIndex ?? 0) - (right.actionIndex ?? 0));

  return {
    actions,
    endedAt: new Date().toISOString(),
    overheadRpc,
    plannedActions: bots.length * ticks,
    startedAt: new Date(workloadStartedAtMs).toISOString(),
    ticks,
    warmupMs,
  };
}

export function resolveActionKind(tick: number): WorkloadActionKind {
  return ACTION_PATTERN[tick % ACTION_PATTERN.length]!;
}

export function parseStructureIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(parseEntityId);
  }
  if (typeof value !== "string") {
    throw new Error(`Unexpected settlement structure_ids value: ${String(value)}`);
  }

  try {
    const decoded = JSON.parse(value) as unknown;
    if (Array.isArray(decoded)) return decoded.map(parseEntityId);
  } catch {
    // Torii versions have emitted both JSON arrays and comma-delimited felt lists.
  }

  const ids = value.match(/0x[0-9a-f]+|\d+/gi)?.map(parseEntityId) ?? [];
  if (ids.length === 0) {
    throw new Error(`Could not parse settlement structure_ids: ${value}`);
  }
  return ids;
}

export function chooseOutwardDirection(coord: Coord, center: Coord): number {
  return [0, 1, 2, 3, 4, 5]
    .map((direction) => ({ direction, distance: cubeDistance(neighbor(coord, direction), center) }))
    .sort((left, right) => right.distance - left.distance || left.direction - right.direction)[0]!.direction;
}

export function millisecondsUntilNextArmyTick(nowMs: number): number {
  const nowSeconds = Math.floor(nowMs / 1_000);
  const nextTickSeconds = (Math.floor(nowSeconds / ARMY_TICK_SECONDS) + 1) * ARMY_TICK_SECONDS;
  return (nextTickSeconds - nowSeconds + 1) * 1_000;
}

export function neighbor(coord: Coord, direction: number): Coord {
  const evenRow = coord.y % 2 === 0;
  const deltas = evenRow
    ? [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, -1],
      ]
    : [
        [1, 0],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
      ];
  const [x, y] = deltas[direction] ?? [];
  if (x === undefined || y === undefined) throw new Error(`Unknown direction ${direction}`);
  return { x: coord.x + x, y: coord.y + y };
}

export function oppositeDirection(direction: number): number {
  if (!Number.isInteger(direction) || direction < 0 || direction > 5) {
    throw new Error(`Unknown direction ${direction}`);
  }
  return (direction + 3) % 6;
}

export function prioritizeExplorer<T extends ExplorerPriority>(
  candidates: T[],
  kind: "move" | "explore",
): T | undefined {
  return candidates.sort((left, right) => {
    const frontierPriority = kind === "move" ? Number(left.atFrontier) - Number(right.atFrontier) : 0;
    return frontierPriority || left.lastUsedAt - right.lastUsedAt;
  })[0];
}

async function settleBot({
  harnessAccount,
  gameId,
  provider,
  systems,
  toriiObserver,
}: {
  harnessAccount: HarnessAccount;
  gameId: number;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
  toriiObserver: ToriiObserver;
}): Promise<TrackedTransaction> {
  const usernameFelt = shortString.encodeShortString(`bot-${harnessAccount.botId.toString().padStart(3, "0")}`);
  const calls = buildBlitzSettleCalls({
    blitzSystemsAddress: systems.blitzRealm,
    signerAddress: harnessAccount.address,
    usernameFelt,
    gameId,
    cosmeticTokenIds: [],
  });

  return trackTransaction({
    account: harnessAccount.account,
    botId: harnessAccount.botId,
    calls,
    kind: "settle",
    provider,
    stage: "setup",
    toriiObserver,
  });
}

async function provisionBot({
  account,
  botId,
  gameId,
  provider,
  structureIds,
  systems,
  toriiObserver,
}: {
  account: Account;
  botId: number;
  gameId: number;
  provider: RpcProvider;
  structureIds: string[];
  systems: HarnessSystemAddresses;
  toriiObserver: ToriiObserver;
}): Promise<TrackedTransaction> {
  return trackTransaction({
    account,
    botId,
    calls: structureIds.map((structureId) => ({
      contractAddress: systems.blitzRealm,
      entrypoint: "provision_realm",
      calldata: CallData.compile([gameId, structureId]),
    })),
    kind: "provision",
    provider,
    stage: "setup",
    toriiObserver,
  });
}

async function createBotExplorers({
  account,
  botId,
  gameId,
  provider,
  structures,
  systems,
  toriiObserver,
  troopTypes,
}: {
  account: Account;
  botId: number;
  gameId: number;
  provider: RpcProvider;
  structures: StructureState[];
  systems: HarnessSystemAddresses;
  toriiObserver: ToriiObserver;
  troopTypes: Map<string, number>;
}): Promise<TrackedTransaction> {
  return trackTransaction({
    account,
    botId,
    calls: structures.map(({ direction, structureId }) => {
      const troopType = troopTypes.get(structureId);
      if (troopType === undefined) throw new Error(`No starting troop type is indexed for structure ${structureId}`);
      return {
        contractAddress: systems.troopManagement,
        entrypoint: "explorer_create",
        calldata: CallData.compile([gameId, structureId, troopType, 0, EXPLORER_TROOP_AMOUNT, direction]),
      };
    }),
    kind: "create-explorers",
    provider,
    stage: "setup",
    toriiObserver,
  });
}

async function runBotAction({
  actionIndex,
  bot,
  chainTick,
  gameId,
  kind,
  provider,
  rpc,
  scheduledAtMs,
  systems,
  tick,
  toriiObserver,
}: {
  actionIndex: number;
  bot: HarnessBot;
  chainTick: number;
  gameId: number;
  kind: WorkloadActionKind;
  provider: RpcProvider;
  rpc: RpcMetrics;
  scheduledAtMs: number;
  systems: HarnessSystemAddresses;
  tick: number;
  toriiObserver: ToriiObserver;
}): Promise<TrackedTransaction> {
  try {
    if (kind === "produce") {
      return await runProductionAction({
        actionIndex,
        bot,
        chainTick,
        gameId,
        provider,
        rpc,
        scheduledAtMs,
        systems,
        tick,
        toriiObserver,
      });
    }
    return await runExplorerAction({
      actionIndex,
      bot,
      chainTick,
      gameId,
      kind,
      provider,
      rpc,
      scheduledAtMs,
      systems,
      tick,
      toriiObserver,
    });
  } catch (error) {
    return driverFailure({ actionIndex, botId: bot.botId, error, kind, rpc, scheduledAtMs, tick });
  }
}

async function runProductionAction({
  actionIndex,
  bot,
  gameId,
  provider,
  rpc,
  scheduledAtMs,
  systems,
  tick,
  toriiObserver,
}: Omit<Parameters<typeof runBotAction>[0], "kind">): Promise<TrackedTransaction> {
  const structure = bot.structures[bot.nextProductionStructure % bot.structures.length]!;
  bot.nextProductionStructure += 1;
  const resourceBefore = await toriiObserver.readResource(gameId, structure.structureId);

  const transaction = await trackTransaction({
    account: bot.account,
    actionIndex,
    botId: bot.botId,
    calls: {
      contractAddress: systems.production,
      entrypoint: "burn_labor_for_resource_production",
      calldata: CallData.compile([gameId, structure.structureId, [1], [WOOD_RESOURCE_ID]]),
    },
    kind: "produce",
    provider,
    rpc,
    scheduledAtMs,
    stage: "workload",
    tick,
    toriiObserver,
  });
  if (transaction.outcome !== "completed") return transaction;

  try {
    const resourceAfter = await toriiObserver.waitForResource(
      gameId,
      structure.structureId,
      resourceBefore,
      MODEL_UPDATE_TIMEOUT_MS,
    );
    transaction.productionDelta = {
      laborBalance: resourceAfter.laborBalance.toString(),
      laborDelta: (resourceAfter.laborBalance - resourceBefore.laborBalance).toString(),
      woodOutput: resourceAfter.woodOutput.toString(),
      woodOutputDelta: (resourceAfter.woodOutput - resourceBefore.woodOutput).toString(),
    };
  } catch (error) {
    transaction.outcome = "driver_failed";
    transaction.error = errorMessage(error);
  }
  return transaction;
}

async function runExplorerAction({
  actionIndex,
  bot,
  chainTick,
  gameId,
  kind,
  provider,
  rpc,
  scheduledAtMs,
  systems,
  tick,
  toriiObserver,
}: Parameters<typeof runBotAction>[0] & { kind: "move" | "explore" }): Promise<TrackedTransaction> {
  const selectedExplorer = selectExplorer(bot.explorers, kind, chainTick);
  const { calls, direction, resourceBounds } =
    kind === "explore"
      ? await buildSafeExploreCalls(bot.account, selectedExplorer, bot.structures, gameId, systems.troopMovement, rpc)
      : buildMoveCalls(selectedExplorer, gameId, systems.troopMovement);
  const previousCoord = selectedExplorer.coord;
  const previousEventId = selectedExplorer.modelEventId;
  selectedExplorer.lastUsedAt = actionIndex;

  const transaction = await trackTransaction({
    account: bot.account,
    actionIndex,
    botId: bot.botId,
    calls,
    exploreRequested: kind === "explore",
    kind,
    provider,
    resourceBounds,
    rpc,
    scheduledAtMs,
    stage: "workload",
    tick,
    toriiObserver,
  });
  if (transaction.outcome !== "completed") return transaction;

  try {
    const updated = await toriiObserver.waitForExplorer(
      gameId,
      selectedExplorer.explorerId,
      previousEventId,
      MODEL_UPDATE_TIMEOUT_MS,
    );
    applyExplorerUpdate(selectedExplorer, kind, direction, previousCoord, updated);
  } catch (error) {
    transaction.outcome = "driver_failed";
    transaction.error = errorMessage(error);
  }
  return transaction;
}

function selectExplorer(explorers: ExplorerState[], kind: "move" | "explore", chainTick: number): ExplorerState {
  const candidates = explorers.filter((explorer) => {
    // Travel costs 20 stamina plus or minus a 10-point biome modifier, so both actions need a 30-point reserve.
    if (estimatedStamina(explorer, chainTick) < MAX_ACTION_STAMINA_COST) return false;
    if (kind === "explore") return explorerAtFrontier(explorer);
    return explorer.pathDirections.length > 0;
  });

  // Return troops to the frontier before pulling another troop back. Without this priority, the five travel actions
  // in each workload cycle eventually leave every explorer behind the frontier.
  const selected = prioritizeExplorer(candidates, kind);
  if (!selected) {
    throw new Error(`No explorer can safely ${kind}; stamina or path invariant is exhausted`);
  }
  return selected;
}

function chooseExploreDirections(explorer: ExplorerState, structures: StructureState[]): number[] {
  const blocked = explorer.blockedDirections.get(coordKey(explorer.coord)) ?? new Set<number>();
  const previousDirection = explorer.pathDirections.at(-1);
  const preferredDirection = previousDirection ?? explorer.outwardDirection;
  const center = resolveSettlementCenter(structures);
  return [0, 1, 2, 3, 4, 5]
    .filter((direction) => !blocked.has(direction))
    .filter((direction) => previousDirection === undefined || direction !== oppositeDirection(previousDirection))
    .map((direction) => ({
      direction,
      preferred: direction === preferredDirection,
      distance: cubeDistance(neighbor(explorer.coord, direction), center),
    }))
    .sort((left, right) => {
      return (
        Number(right.preferred) - Number(left.preferred) ||
        right.distance - left.distance ||
        left.direction - right.direction
      );
    })
    .map(({ direction }) => direction);
}

function chooseMoveDirection(explorer: ExplorerState): number {
  const pathDirection = explorer.pathDirections.at(-1);
  if (pathDirection === undefined) throw new Error(`Explorer ${explorer.explorerId} has no discovered path to travel`);
  return explorerAtFrontier(explorer) ? oppositeDirection(pathDirection) : pathDirection;
}

async function buildSafeExploreCalls(
  account: Account,
  explorer: ExplorerState,
  structures: StructureState[],
  gameId: number,
  troopMovementAddress: string,
  rpc: RpcMetrics,
): Promise<{ calls: Call[]; direction: number; resourceBounds: ResourceBoundsBN }> {
  for (const direction of chooseExploreDirections(explorer, structures)) {
    const calls = buildExplorerCalls(explorer.explorerId, direction, true, gameId, troopMovementAddress);
    try {
      const estimate = await measureRpc(rpc, "estimateInvokeFee", () => account.estimateInvokeFee(calls, { tip: 0 }));
      return { calls, direction, resourceBounds: addExecutionHeadroom(estimate.resourceBounds) };
    } catch (error) {
      if (!errorMessage(error).includes("one of the tiles in path is occupied")) throw error;
      const blocked = explorer.blockedDirections.get(coordKey(explorer.coord)) ?? new Set<number>();
      blocked.add(direction);
      explorer.blockedDirections.set(coordKey(explorer.coord), blocked);
    }
  }
  throw new Error(`Explorer ${explorer.explorerId} has no unoccupied exploration direction`);
}

function buildMoveCalls(
  explorer: ExplorerState,
  gameId: number,
  troopMovementAddress: string,
): { calls: Call[]; direction: number; resourceBounds?: undefined } {
  const direction = chooseMoveDirection(explorer);
  return {
    calls: buildExplorerCalls(explorer.explorerId, direction, false, gameId, troopMovementAddress),
    direction,
  };
}

function buildExplorerCalls(
  explorerId: string,
  direction: number,
  explore: boolean,
  gameId: number,
  troopMovementAddress: string,
): Call[] {
  const calls: Call[] = [
    {
      contractAddress: troopMovementAddress,
      entrypoint: "explorer_move",
      calldata: CallData.compile([gameId, explorerId, [direction], explore]),
    },
  ];
  if (explore) {
    calls.push({
      contractAddress: troopMovementAddress,
      entrypoint: "explorer_extract_reward",
      calldata: CallData.compile([gameId, explorerId]),
    });
  }
  return calls;
}

function applyExplorerUpdate(
  explorer: ExplorerState,
  kind: "move" | "explore",
  direction: number,
  previousCoord: Coord,
  updated: ExplorerRow,
): void {
  const moved = updated.x !== previousCoord.x || updated.y !== previousCoord.y;
  if (kind === "explore" && moved) {
    explorer.pathDirections.push(direction);
    explorer.atFrontier = true;
  }
  if (kind === "explore" && !moved) {
    const blocked = explorer.blockedDirections.get(coordKey(previousCoord)) ?? new Set<number>();
    blocked.add(direction);
    explorer.blockedDirections.set(coordKey(previousCoord), blocked);
    explorer.atFrontier = true;
  }
  if (kind === "move") explorer.atFrontier = !explorer.atFrontier;

  explorer.coord = { x: updated.x, y: updated.y };
  explorer.modelEventId = updated.eventId;
  explorer.stamina = updated.stamina;
  explorer.staminaUpdatedTick = updated.staminaUpdatedTick;
}

function explorerAtFrontier(explorer: ExplorerState): boolean {
  return explorer.atFrontier;
}

function estimatedStamina(explorer: ExplorerState, chainTick: number): number {
  const elapsedTicks = Math.max(0, chainTick - explorer.staminaUpdatedTick);
  return Math.min(STAMINA_MAX, explorer.stamina + elapsedTicks * STAMINA_GAIN_PER_TICK);
}

async function waitForAllExplorersToReachFullStamina(
  provider: RpcProvider,
  bots: HarnessBot[],
  rpc: RpcMetrics,
): Promise<number> {
  const startedAtMs = Date.now();
  const deadline = startedAtMs + STAMINA_WARMUP_TIMEOUT_MS;

  while (Date.now() <= deadline) {
    const chainTick = await readCurrentArmyTick(provider, rpc);
    const allExplorersReady = bots.every((bot) => {
      return bot.explorers.every((explorer) => estimatedStamina(explorer, chainTick) >= STAMINA_MAX);
    });
    if (allExplorersReady) return Date.now() - startedAtMs;
    await sleep(STAMINA_WARMUP_POLL_INTERVAL_MS);
  }

  throw new Error(`Explorers did not reach ${STAMINA_MAX} stamina within 360 seconds of chain time`);
}

async function readCurrentArmyTick(provider: RpcProvider, rpc: RpcMetrics): Promise<number> {
  const block = await measureRpc(rpc, "getBlock", () => provider.getBlock("latest"));
  return Math.floor(Number(block.timestamp) / ARMY_TICK_SECONDS);
}

async function trackTransaction(options: TrackTransactionOptions): Promise<TrackedTransaction> {
  const preflightStartedAtMs = Date.now();
  const rpc = options.rpc ?? createRpcMetrics();
  const record: TrackedTransaction = {
    actionIndex: options.actionIndex,
    botId: options.botId,
    exploreRequested: options.exploreRequested,
    kind: options.kind,
    outcome: "submit_failed",
    rpc: snapshotRpcMetrics(rpc),
    scheduledAt: options.scheduledAtMs === undefined ? undefined : toIso(options.scheduledAtMs),
    stage: options.stage,
    submitDelayMs:
      options.scheduledAtMs === undefined ? undefined : Math.max(0, preflightStartedAtMs - options.scheduledAtMs),
    submitStartedAt: toIso(preflightStartedAtMs),
    tick: options.tick,
  };

  let transactionHash: string;
  try {
    const resourceBounds =
      options.resourceBounds ?? (await estimateResourceBounds(options.account, options.calls, rpc));
    const submitStartedAtMs = Date.now();
    record.submitStartedAt = toIso(submitStartedAtMs);
    const submitted = await options.account.execute(options.calls, { resourceBounds, tip: 0 });
    const submittedAtMs = Date.now();
    transactionHash = normalizeTransactionHash(submitted.transaction_hash);
    record.transactionHash = transactionHash;
    record.submittedAt = toIso(submittedAtMs);
    record.submitMs = submittedAtMs - submitStartedAtMs;
    if (options.scheduledAtMs !== undefined) record.submitDelayMs = Math.max(0, submittedAtMs - options.scheduledAtMs);
  } catch (error) {
    record.error = errorMessage(error);
    record.rpc = snapshotRpcMetrics(rpc);
    return record;
  }

  const timeoutMs = transactionTimeoutMs(options.stage);
  const [receipt, index] = await Promise.all([
    waitForReceiptLifecycle(options.provider, transactionHash, Date.parse(record.submittedAt!), timeoutMs, rpc),
    options.toriiObserver.waitForTransaction(transactionHash, timeoutMs),
  ]);

  Object.assign(record, receipt);
  if (index.transactionIndexedAt !== undefined) {
    record.transactionIndexedAt = toIso(index.transactionIndexedAt);
  }
  if (index.eventIndexedAt !== undefined) record.eventIndexedAt = toIso(index.eventIndexedAt);
  if (index.transactionIndexedAt !== undefined && index.eventIndexedAt !== undefined) {
    const indexedAtMs = Math.max(index.transactionIndexedAt, index.eventIndexedAt);
    record.indexedAt = toIso(indexedAtMs);
    record.indexedMs = indexedAtMs - Date.parse(record.submittedAt!);
  }

  if (record.outcome === "completed" && record.indexedAt === undefined) {
    record.outcome = "index_timeout";
    record.error = `Transaction hash did not appear in both Torii transactions and events within ${timeoutMs / 1_000} seconds`;
  }
  record.rpc = snapshotRpcMetrics(rpc);
  return record;
}

async function estimateResourceBounds(
  account: Account,
  calls: Call | Call[],
  rpc: RpcMetrics,
): Promise<ResourceBoundsBN> {
  const estimate = await measureRpc(rpc, "estimateInvokeFee", () => account.estimateInvokeFee(calls, { tip: 0 }));
  return addExecutionHeadroom(estimate.resourceBounds);
}

function addExecutionHeadroom(resourceBounds: ResourceBoundsBN): ResourceBoundsBN {
  return {
    l1_data_gas: multiplyResourceBound(resourceBounds.l1_data_gas),
    l1_gas: multiplyResourceBound(resourceBounds.l1_gas),
    l2_gas: multiplyResourceBound(resourceBounds.l2_gas, MAX_L2_GAS_AMOUNT),
  };
}

function multiplyResourceBound(
  resourceBound: ResourceBoundsBN["l2_gas"],
  maximumAmount?: bigint,
): ResourceBoundsBN["l2_gas"] {
  const multipliedAmount = resourceBound.max_amount * RESOURCE_HEADROOM_MULTIPLIER;
  return {
    ...resourceBound,
    max_amount: maximumAmount === undefined ? multipliedAmount : minBigInt(multipliedAmount, maximumAmount),
  };
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

async function waitForReceiptLifecycle(
  provider: RpcProvider,
  transactionHash: string,
  submittedAtMs: number,
  timeoutMs: number,
  rpc: RpcMetrics,
): Promise<Partial<TrackedTransaction>> {
  const deadline = Date.now() + timeoutMs;
  let preConfirmedAtMs: number | undefined;
  let lastStatus: string | undefined;

  while (Date.now() <= deadline) {
    try {
      const status = (await measureRpc(rpc, "getTransactionStatus", () =>
        provider.getTransactionStatus(transactionHash),
      )) as {
        execution_status?: string;
        finality_status?: string;
        failure_reason?: string;
      };
      lastStatus = status.finality_status;
      const observedAtMs = Date.now();

      if (status.execution_status === "REVERTED") {
        return {
          error: status.failure_reason ?? JSON.stringify(status),
          finalityStatus: lastStatus,
          outcome: "reverted",
        };
      }
      if (status.finality_status === "REJECTED") {
        return {
          error: status.failure_reason ?? JSON.stringify(status),
          finalityStatus: lastStatus,
          outcome: "rejected",
        };
      }
      if (
        preConfirmedAtMs === undefined &&
        ["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status ?? "")
      ) {
        preConfirmedAtMs = observedAtMs;
      }
      if (["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status ?? "")) {
        return {
          acceptedOnL2At: toIso(observedAtMs),
          acceptedOnL2Ms: observedAtMs - submittedAtMs,
          finalityStatus: status.finality_status,
          outcome: "completed",
          preConfirmedAt: toIso(preConfirmedAtMs ?? observedAtMs),
          preConfirmedMs: (preConfirmedAtMs ?? observedAtMs) - submittedAtMs,
        };
      }
    } catch {
      // A just-submitted transaction is temporarily unknown to the RPC.
    }
    await sleep(RECEIPT_POLL_INTERVAL_MS);
  }

  return {
    error: `Transaction did not reach ACCEPTED_ON_L2 within ${timeoutMs / 1_000} seconds`,
    finalityStatus: lastStatus,
    outcome: "confirmation_timeout",
    preConfirmedAt: preConfirmedAtMs === undefined ? undefined : toIso(preConfirmedAtMs),
    preConfirmedMs: preConfirmedAtMs === undefined ? undefined : preConfirmedAtMs - submittedAtMs,
  };
}

async function readMapCenter(toriiSqlUrl: string, gameId: number): Promise<Coord> {
  const rows = await queryTorii<{ map_center_offset: number }>(
    toriiSqlUrl,
    `SELECT map_center_offset FROM "s2-WorldConfig" WHERE game_id = ${sqlInteger(gameId)} LIMIT 1`,
  );
  const row = rows[0];
  if (!row) throw new Error(`WorldConfig ${gameId} is not indexed`);
  const coordinate = CENTER_COORD - Number(row.map_center_offset);
  return { x: coordinate, y: coordinate };
}

async function readSettlementStructureIds(toriiSqlUrl: string, gameId: number, address: string): Promise<string[]> {
  const player = sqlHex(address);
  const rows = await queryTorii<{ structure_ids: unknown }>(
    toriiSqlUrl,
    `SELECT structure_ids FROM "s2-BlitzSettlement" WHERE game_id = ${sqlInteger(gameId)} AND player = '${player}' LIMIT 1`,
  );
  const row = rows[0];
  if (!row) throw new Error(`Settlement for ${address} in game ${gameId} is not indexed`);
  const structureIds = parseStructureIds(row.structure_ids);
  if (structureIds.length !== EXPLORER_COUNT_PER_BOT) {
    throw new Error(`Expected ${EXPLORER_COUNT_PER_BOT} structures for ${address}, found ${structureIds.length}`);
  }
  return structureIds;
}

async function readStructures(
  toriiSqlUrl: string,
  gameId: number,
  structureIds: string[],
  mapCenter: Coord,
): Promise<StructureState[]> {
  const ids = structureIds.map(sqlInteger).join(", ");
  const rows = await queryTorii<{ entity_id: number | string; x: number; y: number }>(
    toriiSqlUrl,
    `SELECT entity_id, "base.coord_x" AS x, "base.coord_y" AS y FROM "s2-Structure" WHERE game_id = ${sqlInteger(gameId)} AND entity_id IN (${ids})`,
  );
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected ${structureIds.length} indexed structures, found ${rows.length}`);
  }

  const byId = new Map(rows.map((row) => [parseEntityId(row.entity_id), row]));
  return structureIds.map((structureId) => {
    const row = byId.get(structureId);
    if (!row) throw new Error(`Structure ${structureId} is not indexed`);
    const coord = { x: Number(row.x), y: Number(row.y) };
    return { coord, direction: chooseOutwardDirection(coord, mapCenter), structureId };
  });
}

async function readExplorers(toriiSqlUrl: string, gameId: number, structureIds: string[]): Promise<ExplorerRow[]> {
  const ids = structureIds.map(sqlInteger).join(", ");
  const rows = await queryTorii<{
    event_id: string;
    explorer_id: number | string;
    owner: number | string;
    stamina: number | string;
    stamina_tick: number | string;
    x: number;
    y: number;
  }>(
    toriiSqlUrl,
    `SELECT internal_event_id AS event_id, explorer_id, owner, "troops.stamina.amount" AS stamina, "troops.stamina.updated_tick" AS stamina_tick, "coord.x" AS x, "coord.y" AS y FROM "s2-ExplorerTroops" WHERE game_id = ${sqlInteger(gameId)} AND owner IN (${ids})`,
  );
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected ${structureIds.length} indexed explorers, found ${rows.length}`);
  }
  return rows.map(toExplorerRow);
}

async function readStartingTroopTypes(
  toriiSqlUrl: string,
  gameId: number,
  structureIds: string[],
): Promise<Map<string, number>> {
  const ids = structureIds.map(sqlInteger).join(", ");
  const rows = await queryTorii<{
    crossbowman: string;
    entity_id: number | string;
    knight: string;
    paladin: string;
  }>(
    toriiSqlUrl,
    `SELECT entity_id, KNIGHT_T1_BALANCE AS knight, PALADIN_T1_BALANCE AS paladin, CROSSBOWMAN_T1_BALANCE AS crossbowman FROM "s2-Resource" WHERE game_id = ${sqlInteger(gameId)} AND entity_id IN (${ids})`,
  );
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected resources for ${structureIds.length} structures, found ${rows.length}`);
  }

  return new Map(
    rows.map((row) => {
      const balances = [row.knight, row.paladin, row.crossbowman];
      const troopType = balances.findIndex((balance) => BigInt(balance) >= EXPLORER_TROOP_AMOUNT);
      if (troopType < 0) throw new Error(`Structure ${row.entity_id} has no funded T1 troop type`);
      return [parseEntityId(row.entity_id), troopType];
    }),
  );
}

function buildExplorerState(structure: StructureState, rows: ExplorerRow[]): ExplorerState {
  const row = rows.find((candidate) => candidate.owner === structure.structureId);
  if (!row) throw new Error(`Explorer for structure ${structure.structureId} is not indexed`);
  return {
    atFrontier: true,
    blockedDirections: new Map(),
    coord: { x: row.x, y: row.y },
    explorerId: row.explorerId,
    lastUsedAt: -1,
    modelEventId: row.eventId,
    outwardDirection: structure.direction,
    pathDirections: [],
    stamina: row.stamina,
    staminaUpdatedTick: row.staminaUpdatedTick,
    structureId: structure.structureId,
  };
}

function toExplorerRow(row: {
  event_id: string;
  explorer_id: number | string;
  owner: number | string;
  stamina: number | string;
  stamina_tick: number | string;
  x: number;
  y: number;
}): ExplorerRow {
  return {
    eventId: row.event_id,
    explorerId: parseEntityId(row.explorer_id),
    owner: parseEntityId(row.owner),
    stamina: Number(row.stamina),
    staminaUpdatedTick: Number(row.stamina_tick),
    x: Number(row.x),
    y: Number(row.y),
  };
}

function assertCompleted(transaction: TrackedTransaction): void {
  if (transaction.outcome !== "completed") {
    throw new Error(
      `Bot ${transaction.botId} ${transaction.kind} failed (${transaction.outcome}): ${transaction.error ?? "unknown error"}`,
    );
  }
}

function driverFailure({
  actionIndex,
  botId,
  error,
  kind,
  rpc,
  scheduledAtMs,
  tick,
}: {
  actionIndex: number;
  botId: number;
  error: unknown;
  kind: WorkloadActionKind;
  rpc: RpcMetrics;
  scheduledAtMs: number;
  tick: number;
}): TrackedTransaction {
  const now = Date.now();
  return {
    actionIndex,
    botId,
    error: errorMessage(error),
    kind,
    outcome: "driver_failed",
    rpc: snapshotRpcMetrics(rpc),
    scheduledAt: toIso(scheduledAtMs),
    stage: "workload",
    submitDelayMs: Math.max(0, now - scheduledAtMs),
    submitStartedAt: toIso(now),
    tick,
  };
}

export function createRpcMetrics(): RpcMetrics {
  return {
    estimateInvokeFee: { calls: 0, wallMs: 0 },
    getBlock: { calls: 0, wallMs: 0 },
    getTransactionStatus: { calls: 0, wallMs: 0 },
  };
}

async function measureRpc<T>(rpc: RpcMetrics, method: MeasuredRpcMethod, call: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  rpc[method].calls += 1;
  try {
    return await call();
  } finally {
    rpc[method].wallMs += performance.now() - startedAt;
  }
}

function snapshotRpcMetrics(rpc: RpcMetrics): RpcMetrics {
  return {
    estimateInvokeFee: snapshotRpcMethod(rpc.estimateInvokeFee),
    getBlock: snapshotRpcMethod(rpc.getBlock),
    getTransactionStatus: snapshotRpcMethod(rpc.getTransactionStatus),
  };
}

function snapshotRpcMethod(method: RpcMethodMetrics): RpcMethodMetrics {
  return { calls: method.calls, wallMs: roundMilliseconds(method.wallMs) };
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveSettlementCenter(structures: StructureState[]): Coord {
  const x = Math.round(structures.reduce((sum, structure) => sum + structure.coord.x, 0) / structures.length);
  const y = Math.round(structures.reduce((sum, structure) => sum + structure.coord.y, 0) / structures.length);
  return { x, y };
}

function cubeDistance(left: Coord, right: Coord): number {
  const leftCube = evenRowToCube(left);
  const rightCube = evenRowToCube(right);
  return Math.max(
    Math.abs(leftCube.q - rightCube.q),
    Math.abs(leftCube.r - rightCube.r),
    Math.abs(leftCube.s - rightCube.s),
  );
}

function evenRowToCube(coord: Coord): { q: number; r: number; s: number } {
  const q = coord.x - (coord.y + (coord.y & 1)) / 2;
  const r = coord.y;
  return { q, r, s: -q - r };
}

function normalizeTransactionHash(value: string): string {
  const digits = value.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(digits)) throw new Error(`Invalid transaction hash ${value}`);
  return `0x${digits.padStart(64, "0")}`;
}

function sqlHex(value: string): string {
  return normalizeTransactionHash(value);
}

function sqlInteger(value: number | string): string {
  const normalized = parseEntityId(value);
  if (!/^\d+$/.test(normalized)) throw new Error(`Invalid SQL integer ${String(value)}`);
  return normalized;
}

function parseEntityId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Invalid entity id ${String(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`Invalid entity id ${String(value)}`);
  return parsed.toString();
}

function coordKey(coord: Coord): string {
  return `${coord.x}:${coord.y}`;
}

async function sleepUntil(timestampMs: number): Promise<void> {
  const waitMs = timestampMs - Date.now();
  if (waitMs > 0) await sleep(waitMs);
}

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

function transactionTimeoutMs(stage: TransactionStage): number {
  return stage === "workload" ? TRANSACTION_TIMEOUT_MS : SETUP_TRANSACTION_TIMEOUT_MS;
}
