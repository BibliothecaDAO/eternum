import { setTimeout as sleep } from "node:timers/promises";
import { shortString, type Account, type Call, type RpcProvider } from "starknet";
import { type ActionPath, ActionPaths, ActionType, type GameActions } from "@bibliothecadao/eternum";
import { buildBlitzSettleCalls, buildEternumSettleCalls } from "@bibliothecadao/eternum/game-client";
import { ContractAddress, TroopTier, type ID, type TroopType } from "../../../packages/types";
import { mapWithConcurrency, type HarnessAccount } from "./account-factory";
import {
  EXPLORER_TROOP_COUNT,
  type ChainTicks,
  type Coord,
  type ExplorerRow,
  type HarnessGame,
  type HarnessSubmission,
  type ProductionState,
} from "./harness-game";

export type WorkloadActionKind = "move" | "explore" | "produce";
export type TransactionStage = "setup" | "workload";
export type MeasuredRpcMethod = "estimateInvokeFee" | "getBlock" | "getTransactionReceipt" | "getTransactionStatus";
export type WorkloadFailureClass = "game_rule_limit" | "harness_pathing" | "chain_or_driver";
export type WorkloadRevertReason = "tile_contention" | "stamina" | "labor" | "other";
export type TransactionOutcome =
  | "completed"
  | "reverted"
  | "rejected"
  | "submit_failed"
  | "confirmation_timeout"
  | "driver_failed";

interface RpcMethodMetrics {
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
  acceptedOnL2Block?: number;
  acceptedOnL2Ms?: number;
  actionIndex?: number;
  botId: number;
  error?: string;
  exploreRequested?: boolean;
  finalityStatus?: string;
  failureClass?: WorkloadFailureClass;
  gameId: number;
  kind: string;
  outcome: TransactionOutcome;
  preConfirmedAt?: string;
  preConfirmedMs?: number;
  productionDelta?: ProductionDelta;
  revertReason?: WorkloadRevertReason;
  rpc: RpcMetrics;
  scheduledAt?: string;
  stage: TransactionStage;
  submitDelayMs?: number;
  submitStartedAt: string;
  submittedAt?: string;
  submitMs?: number;
  tick?: number;
  transactionHash?: string;
}

export interface HarnessSystemAddresses {
  realm: string;
  registrar: string;
  blitzRealm: string;
  prizeDistribution: string;
  production: string;
  troopManagement: string;
  troopMovement: string;
}

export interface HarnessBot {
  account: Account;
  /** This bot's facade over the shared client: every submit signs with `account`. */
  actions: GameActions;
  address: string;
  botId: number;
  explorers: ExplorerState[];
  gameId: number;
  nextProductionStructure: number;
  structures: StructureState[];
}

export interface WorkloadResult {
  actions: TrackedTransaction[];
  endedAt: string;
  plannedActions: number;
  overheadRpc: RpcMetrics;
  readinessWaitMs: number;
  startedAt: string;
  ticks: number;
}

/** The harness's own route memory for an explorer; its position and stamina are read from RECS when needed. */
interface ExplorerState {
  atFrontier: boolean;
  blockedDirections: Map<string, Set<number>>;
  explorerId: ID;
  lastUsedAt: number;
  outwardDirection: number;
  pathDirections: number[];
  structureId: ID;
}

interface StructureState {
  coord: Coord;
  direction: number;
  structureId: ID;
}

interface ExplorerPriority {
  atFrontier: boolean;
  lastUsedAt: number;
}

interface PrepareHarnessBotsOptions {
  gameType?: HarnessGameType;
  accounts: HarnessAccount[];
  beforeProvision?: () => Promise<void>;
  game: HarnessGame;
  provider: RpcProvider;
  setupConcurrency?: number;
  setupTransactions: TrackedTransaction[];
  systems: HarnessSystemAddresses;
}

interface RunWorkloadOptions {
  bots: HarnessBot[];
  game: HarnessGame;
  intervalSeconds: number;
  minutes: number;
  onTick?: (completedTicks: number, totalTicks: number) => void;
  provider: RpcProvider;
}

interface ExplorerActionPlan {
  direction: number;
  explorer: ExplorerState;
  from: Coord;
  path: ActionPath[];
  target: Coord;
}

interface PathReservation {
  explorerId: ID;
  from: Coord;
  target: Coord;
}

interface TrackTransactionOptions {
  actionIndex?: number;
  botId: number;
  exploreRequested?: boolean;
  gameId: number;
  kind: string;
  provider: RpcProvider;
  rpc?: RpcMetrics;
  scheduledAtMs?: number;
  /** Sends the transaction and resolves with its hash once the chain accepted it. */
  send: () => Promise<HarnessSubmission>;
  stage: TransactionStage;
  tick?: number;
}

export type HarnessGameType = "blitz" | "eternum";

const BLITZ_STRUCTURES_PER_BOT = 3;
const ETERNUM_STRUCTURES_PER_BOT = 1;

const settlementStructureCount = (gameType: HarnessGameType) =>
  gameType === "eternum" ? ETERNUM_STRUCTURES_PER_BOT : BLITZ_STRUCTURES_PER_BOT;
export const RECEIPT_POLL_INTERVAL_MS = 50;
/** The Blitz explore cost: the measured window opens once every bot can afford one explorer action. */
export const FIRST_ACTION_REQUIRED_STAMINA = 30;
const TRANSACTION_TIMEOUT_MS = 30_000;
const SETUP_TRANSACTION_TIMEOUT_MS = 120_000;
const MODEL_UPDATE_TIMEOUT_MS = 30_000;
const ACTION_READINESS_TIMEOUT_MS = 360_000;
const ACTION_READINESS_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SETUP_CONCURRENCY = 6;

class GameRuleLimitError extends Error {}
class HarnessPathingError extends Error {}

/** Where bots intend to be: RECS knows where they are, this knows which tiles are spoken for by an in-flight move. */
class PathReservations {
  private readonly occupiedByExplorer = new Map<string, ID>();
  private readonly reservedByExplorer = new Map<string, ID>();
  private readonly structureCoords = new Set<string>();

  constructor(bots: readonly HarnessBot[], game: HarnessGame) {
    for (const bot of bots) {
      for (const structure of bot.structures) this.structureCoords.add(coordKey(structure.coord));
      for (const explorer of bot.explorers) {
        const key = coordKey(requireExplorer(game, explorer.explorerId).coord);
        const occupant = this.occupiedByExplorer.get(key);
        if (occupant !== undefined) throw new Error(`Explorers ${occupant} and ${explorer.explorerId} share ${key}`);
        this.occupiedByExplorer.set(key, explorer.explorerId);
      }
    }
  }

  canReserve(explorerId: ID, target: Coord): boolean {
    const key = coordKey(target);
    if (this.structureCoords.has(key)) return false;
    const occupant = this.occupiedByExplorer.get(key);
    if (occupant !== undefined && occupant !== explorerId) return false;
    const reservation = this.reservedByExplorer.get(key);
    return reservation === undefined || reservation === explorerId;
  }

  reserve(explorerId: ID, from: Coord, target: Coord): PathReservation {
    if (!this.canReserve(explorerId, target)) {
      throw new HarnessPathingError(`Explorer ${explorerId} target ${coordKey(target)} is occupied`);
    }
    this.reservedByExplorer.set(coordKey(target), explorerId);
    return { explorerId, from, target };
  }

  complete(reservation: PathReservation, actual: Coord): void {
    this.reservedByExplorer.delete(coordKey(reservation.target));
    if (this.occupiedByExplorer.get(coordKey(reservation.from)) === reservation.explorerId) {
      this.occupiedByExplorer.delete(coordKey(reservation.from));
    }
    this.occupiedByExplorer.set(coordKey(actual), reservation.explorerId);
  }

  cancel(reservation: PathReservation): void {
    this.reservedByExplorer.delete(coordKey(reservation.target));
  }
}

// The ten-minute acceptance window gives the exact requested 50/30/20 mix. Three explores prime independent travel
// routes, then later explores are spaced across stamina ticks instead of being re-bursted at each ten-action boundary.
const ACTION_PATTERN: readonly WorkloadActionKind[] = [
  "explore",
  "explore",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "move",
  "move",
  "explore",
  "move",
];
const STEADY_ACTION_PATTERN: readonly WorkloadActionKind[] = [
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
  "produce",
  "move",
  "explore",
  "move",
];

export async function prepareHarnessBots({
  gameType = "blitz",
  accounts,
  beforeProvision,
  game,
  provider,
  setupConcurrency = DEFAULT_SETUP_CONCURRENCY,
  setupTransactions,
  systems,
}: PrepareHarnessBotsOptions): Promise<HarnessBot[]> {
  await mapWithConcurrency(accounts, setupConcurrency, async (harnessAccount) => {
    const settle = await settleBot({ harnessAccount, game, gameType, provider, systems });
    setupTransactions.push(settle);
    assertCompleted(settle);
  });

  await beforeProvision?.();

  return mapWithConcurrency(accounts, setupConcurrency, async (harnessAccount) => {
    const structureIds = await waitForSettlement(game, harnessAccount.address, gameType);
    const structures = await waitForStructures(game, structureIds);

    if (gameType === "blitz") {
      const provision = await provisionBot({ harnessAccount, game, provider, structureIds, systems });
      setupTransactions.push(provision);
      assertCompleted(provision);
    }

    const troopTypes = await waitForStartingTroopTypes(game, structureIds);
    const actions = game.actionsFor(harnessAccount.account);
    for (const structure of structures) {
      const createExplorer = await createBotExplorer({ actions, harnessAccount, game, provider, structure, troopTypes });
      setupTransactions.push(createExplorer);
      assertCompleted(createExplorer);
    }

    const explorers = await waitForExplorers(game, structures);
    return {
      account: harnessAccount.account,
      actions,
      address: harnessAccount.address,
      botId: harnessAccount.botId,
      explorers,
      gameId: game.gameId,
      nextProductionStructure: 0,
      structures,
    };
  });
}

export async function runWorkload({
  bots,
  game,
  intervalSeconds,
  minutes,
  onTick,
  provider,
}: RunWorkloadOptions): Promise<WorkloadResult> {
  const ticks = resolveWorkloadTicks(minutes, intervalSeconds);
  const overheadRpc = createRpcMetrics();
  const readinessWaitMs = await waitForEveryBotToHaveActionStamina(game, provider, bots, overheadRpc);

  const workloadStartedAtMs = Date.now();
  const actions: TrackedTransaction[] = [];
  const botQueues = new Map(bots.map((bot) => [bot.botId, Promise.resolve()]));
  const botSpacingMs = (intervalSeconds * 1_000) / bots.length;
  const pathReservations = new PathReservations(bots, game);

  for (let tick = 0; tick < ticks; tick += 1) {
    for (const [botIndex, bot] of bots.entries()) {
      const scheduledAtMs = workloadStartedAtMs + tick * intervalSeconds * 1_000 + botIndex * botSpacingMs;
      await sleepUntil(scheduledAtMs);
      const actionIndex = tick * bots.length + botIndex;
      const previous = botQueues.get(bot.botId)!;
      botQueues.set(
        bot.botId,
        previous.then(async () => {
          const rpc = createRpcMetrics();
          const action = await runBotAction({
            actionIndex,
            bot,
            game,
            kind: resolveActionKind(tick),
            pathReservations,
            provider,
            rpc,
            scheduledAtMs,
            tick,
          });
          actions.push(action);
        }),
      );
    }

    onTick?.(tick + 1, ticks);
  }

  await Promise.all(botQueues.values());
  actions.sort((left, right) => (left.actionIndex ?? 0) - (right.actionIndex ?? 0));

  return {
    actions,
    endedAt: new Date().toISOString(),
    overheadRpc,
    plannedActions: bots.length * ticks,
    readinessWaitMs,
    startedAt: new Date(workloadStartedAtMs).toISOString(),
    ticks,
  };
}

export function resolveActionKind(tick: number): WorkloadActionKind {
  if (tick < ACTION_PATTERN.length) return ACTION_PATTERN[tick]!;
  return STEADY_ACTION_PATTERN[(tick - ACTION_PATTERN.length) % STEADY_ACTION_PATTERN.length]!;
}

export function resolveWorkloadTicks(minutes: number, intervalSeconds: number): number {
  return Math.ceil((minutes * 60) / intervalSeconds);
}

export function chooseOutwardDirection(coord: Coord, center: Coord): number {
  return [0, 1, 2, 3, 4, 5]
    .map((direction) => ({ direction, distance: cubeDistance(neighbor(coord, direction), center) }))
    .sort((left, right) => right.distance - left.distance || left.direction - right.direction)[0]!.direction;
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
  return [...candidates].sort((left, right) => {
    const frontierPriority = kind === "move" ? Number(left.atFrontier) - Number(right.atFrontier) : 0;
    return frontierPriority || left.lastUsedAt - right.lastUsedAt;
  })[0];
}

/** Raw calls a bot signs itself: settlement and provisioning have no client action, so they go straight to the account. */
export async function submitCalls(account: Account, calls: Call | Call[]): Promise<HarnessSubmission> {
  const { transaction_hash } = await account.execute(calls);
  return { transactionHash: transaction_hash };
}

async function settleBot({
  gameType,
  harnessAccount,
  game,
  provider,
  systems,
}: {
  gameType: HarnessGameType;
  harnessAccount: HarnessAccount;
  game: HarnessGame;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
}): Promise<TrackedTransaction> {
  const usernameFelt = shortString.encodeShortString(`bot-${harnessAccount.botId.toString().padStart(3, "0")}`);
  const calls =
    gameType === "eternum"
      ? buildEternumSettleCalls({
          realmSystemsAddress: systems.realm,
          signerAddress: harnessAccount.address,
          usernameFelt,
          gameId: game.gameId,
        })
      : buildBlitzSettleCalls({
          blitzSystemsAddress: systems.blitzRealm,
          signerAddress: harnessAccount.address,
          usernameFelt,
          gameId: game.gameId,
          cosmeticTokenIds: [],
          grantStartingTroops: true,
        });

  return trackTransaction({
    botId: harnessAccount.botId,
    gameId: game.gameId,
    kind: "settle",
    provider,
    send: () => submitCalls(harnessAccount.account, calls),
    stage: "setup",
  });
}

async function provisionBot({
  harnessAccount,
  game,
  provider,
  structureIds,
  systems,
}: {
  harnessAccount: HarnessAccount;
  game: HarnessGame;
  provider: RpcProvider;
  structureIds: ID[];
  systems: HarnessSystemAddresses;
}): Promise<TrackedTransaction> {
  const calls = structureIds.map((structureId) => ({
    contractAddress: systems.blitzRealm,
    entrypoint: "provision_realm",
    calldata: [game.gameId.toString(), structureId.toString()],
  }));
  return trackTransaction({
    botId: harnessAccount.botId,
    gameId: game.gameId,
    kind: "provision",
    provider,
    send: () => submitCalls(harnessAccount.account, calls),
    stage: "setup",
  });
}

async function createBotExplorer({
  actions,
  harnessAccount,
  game,
  provider,
  structure,
  troopTypes,
}: {
  actions: GameActions;
  harnessAccount: HarnessAccount;
  game: HarnessGame;
  provider: RpcProvider;
  structure: StructureState;
  troopTypes: Map<ID, TroopType>;
}): Promise<TrackedTransaction> {
  const troopType = troopTypes.get(structure.structureId);
  if (troopType === undefined) throw new Error(`No starting troop type exists for structure ${structure.structureId}`);
  return trackTransaction({
    botId: harnessAccount.botId,
    gameId: game.gameId,
    kind: "create-explorer",
    provider,
    send: () =>
      game.submit(harnessAccount.account, () =>
        actions.createExplorerArmy({
          structureId: structure.structureId,
          troopType,
          troopTier: TroopTier.T1,
          troopCount: EXPLORER_TROOP_COUNT,
          spawnDirection: structure.direction,
        }),
      ),
    stage: "setup",
  });
}

interface RunBotActionOptions {
  actionIndex: number;
  bot: HarnessBot;
  game: HarnessGame;
  kind: WorkloadActionKind;
  pathReservations: PathReservations;
  provider: RpcProvider;
  rpc: RpcMetrics;
  scheduledAtMs: number;
  tick: number;
}

type ExecuteBotActionOptions = RunBotActionOptions & { chainTicks: ChainTicks };

async function runBotAction(options: RunBotActionOptions): Promise<TrackedTransaction> {
  try {
    const chainTicks = await readChainTicks(options.game, options.provider, options.rpc);
    const transaction = await executeBotAction({ ...options, chainTicks });
    classifyTransactionFailure(transaction);
    return transaction;
  } catch (error) {
    const { actionIndex, bot, kind, rpc, scheduledAtMs, tick } = options;
    return driverFailure({ actionIndex, botId: bot.botId, error, gameId: bot.gameId, kind, rpc, scheduledAtMs, tick });
  }
}

async function executeBotAction(options: ExecuteBotActionOptions): Promise<TrackedTransaction> {
  if (options.kind === "produce") return runProductionAction(options);
  return runExplorerAction({ ...options, kind: options.kind });
}

async function runProductionAction({
  actionIndex,
  bot,
  game,
  provider,
  rpc,
  scheduledAtMs,
  tick,
}: Omit<ExecuteBotActionOptions, "chainTicks" | "kind" | "pathReservations">): Promise<TrackedTransaction> {
  const structure = bot.structures[bot.nextProductionStructure % bot.structures.length]!;
  bot.nextProductionStructure += 1;
  const before = requireProduction(game, structure.structureId);

  const transaction = await trackTransaction({
    actionIndex,
    botId: bot.botId,
    gameId: bot.gameId,
    kind: "produce",
    provider,
    rpc,
    scheduledAtMs,
    send: () => game.submit(bot.account, () => game.produceWood(bot.account, structure.structureId)),
    stage: "workload",
    tick,
  });
  if (transaction.outcome !== "completed") {
    return transaction;
  }

  try {
    const after = await game.waitFor(
      () => changedProduction(before, game.production(structure.structureId)),
      MODEL_UPDATE_TIMEOUT_MS,
      () => `Resource ${structure.structureId} labor or wood output delta`,
    );
    transaction.productionDelta = {
      laborBalance: after.laborBalance.toString(),
      laborDelta: (after.laborBalance - before.laborBalance).toString(),
      woodOutput: after.woodOutput.toString(),
      woodOutputDelta: (after.woodOutput - before.woodOutput).toString(),
    };
  } catch (error) {
    transaction.outcome = "driver_failed";
    transaction.error = errorMessage(error);
    transaction.failureClass = "chain_or_driver";
  }
  return transaction;
}

async function runExplorerAction({
  actionIndex,
  bot,
  chainTicks,
  game,
  kind,
  pathReservations,
  provider,
  rpc,
  scheduledAtMs,
  tick,
}: ExecuteBotActionOptions & { kind: "move" | "explore" }): Promise<TrackedTransaction> {
  const plan = planExplorerAction(bot, kind, chainTicks, game, pathReservations);
  const selectedExplorer = plan.explorer;
  selectedExplorer.lastUsedAt = actionIndex;
  const reservation = pathReservations.reserve(selectedExplorer.explorerId, plan.from, plan.target);
  const before = requireExplorer(game, selectedExplorer.explorerId);

  const transaction = await trackTransaction({
    actionIndex,
    botId: bot.botId,
    exploreRequested: kind === "explore",
    gameId: bot.gameId,
    kind,
    provider,
    rpc,
    scheduledAtMs,
    send: () =>
      game.submit(bot.account, () =>
        bot.actions.moveArmy({
          explorerId: selectedExplorer.explorerId,
          path: plan.path,
          currentArmiesTick: chainTicks.armies,
        }),
      ),
    stage: "workload",
    tick,
  });
  if (transaction.outcome !== "completed") {
    pathReservations.cancel(reservation);
    return transaction;
  }

  try {
    const after = await game.waitFor(
      () => changedExplorer(before, game.explorer(selectedExplorer.explorerId)),
      MODEL_UPDATE_TIMEOUT_MS,
      () => `Explorer ${selectedExplorer.explorerId}`,
    );
    pathReservations.complete(reservation, after.coord);
    applyExplorerUpdate(selectedExplorer, kind, plan.direction, before.coord, after.coord);
  } catch (error) {
    pathReservations.complete(reservation, plan.target);
    transaction.outcome = "driver_failed";
    transaction.error = errorMessage(error);
    transaction.failureClass = "chain_or_driver";
  }
  return transaction;
}

/**
 * The client plans every legal step from the explorer's RECS position (occupancy, biome stamina, food); the harness
 * only chooses which of those steps keeps its route outward and clear of the other bots' reservations.
 */
function planExplorerAction(
  bot: HarnessBot,
  kind: "move" | "explore",
  chainTicks: ChainTicks,
  game: HarnessGame,
  pathReservations: PathReservations,
): ExplorerActionPlan {
  const routeReady = bot.explorers.filter((explorer) =>
    kind === "explore" ? explorer.atFrontier : explorer.pathDirections.length > 0,
  );
  const indexes = game.armyPathIndexes();
  const wantedActionType = kind === "explore" ? ActionType.Explore : ActionType.Move;
  const remaining = [...routeReady];
  let staminaShort = false;
  while (remaining.length > 0) {
    const explorer = prioritizeExplorer(remaining, kind)!;
    remaining.splice(remaining.indexOf(explorer), 1);
    const from = requireExplorer(game, explorer.explorerId).coord;
    const paths = bot.actions.armyPaths({
      explorerId: explorer.explorerId,
      ...indexes,
      currentDefaultTick: chainTicks.default,
      currentArmiesTick: chainTicks.armies,
      playerAddress: ContractAddress(bot.address),
    });
    const directions =
      kind === "explore" ? chooseExploreDirections(explorer, from, bot.structures) : [chooseMoveDirection(explorer)];
    for (const direction of directions) {
      const target = neighbor(from, direction);
      if (!pathReservations.canReserve(explorer.explorerId, target)) continue;
      const path = paths.get(ActionPaths.posKey({ col: target.x, row: target.y }));
      if (path && ActionPaths.getActionType(path) === wantedActionType) {
        return { direction, explorer, from, path, target };
      }
      staminaShort ||= game.explorerStamina(explorer.explorerId, chainTicks.armies) < game.minimumStaminaFor(kind);
    }
  }

  if (staminaShort) {
    throw new GameRuleLimitError(
      `No explorer has enough stamina for ${kind}; the cheapest ${kind} costs ${game.minimumStaminaFor(kind)}`,
    );
  }
  const routeState = bot.explorers
    .map((explorer) => {
      const at = coordKey(requireExplorer(game, explorer.explorerId).coord);
      const blocked = [...(explorer.blockedDirections.get(at) ?? [])].join(",");
      return `${explorer.explorerId}@${at} path=${explorer.pathDirections.length} blocked=${blocked}`;
    })
    .join("; ");
  throw new HarnessPathingError(`No collision-free ${kind} route is available for bot ${bot.botId}: ${routeState}`);
}

function chooseExploreDirections(explorer: ExplorerState, from: Coord, structures: StructureState[]): number[] {
  const blocked = explorer.blockedDirections.get(coordKey(from)) ?? new Set<number>();
  const previousDirection = explorer.pathDirections.at(-1);
  const preferredDirection = previousDirection ?? explorer.outwardDirection;
  const center = resolveSettlementCenter(structures);
  return [0, 1, 2, 3, 4, 5]
    .filter((direction) => !blocked.has(direction))
    .filter((direction) => previousDirection === undefined || direction !== oppositeDirection(previousDirection))
    .map((direction) => ({
      direction,
      preferred: direction === preferredDirection,
      distance: cubeDistance(neighbor(from, direction), center),
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
  return explorer.atFrontier ? oppositeDirection(pathDirection) : pathDirection;
}

function applyExplorerUpdate(
  explorer: ExplorerState,
  kind: "move" | "explore",
  direction: number,
  previousCoord: Coord,
  updatedCoord: Coord,
): void {
  const moved = updatedCoord.x !== previousCoord.x || updatedCoord.y !== previousCoord.y;
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
}

async function waitForEveryBotToHaveActionStamina(
  game: HarnessGame,
  provider: RpcProvider,
  bots: HarnessBot[],
  rpc: RpcMetrics,
): Promise<number> {
  const startedAtMs = Date.now();
  const deadline = startedAtMs + ACTION_READINESS_TIMEOUT_MS;

  while (Date.now() <= deadline) {
    const { armies } = await readChainTicks(game, provider, rpc);
    const everyBotReady = bots.every((bot) =>
      bot.explorers.some((explorer) => game.explorerStamina(explorer.explorerId, armies) >= FIRST_ACTION_REQUIRED_STAMINA),
    );
    if (everyBotReady) return Date.now() - startedAtMs;
    await sleep(ACTION_READINESS_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Every bot did not gain ${FIRST_ACTION_REQUIRED_STAMINA} explorer stamina within 360 seconds of chain time`,
  );
}

async function readChainTicks(game: HarnessGame, provider: RpcProvider, rpc: RpcMetrics): Promise<ChainTicks> {
  const block = await measureRpc(rpc, "getBlock", () => provider.getBlock("latest"));
  return game.ticksAt(Number(block.timestamp));
}

export async function trackTransaction(options: TrackTransactionOptions): Promise<TrackedTransaction> {
  const preflightStartedAtMs = Date.now();
  const rpc = options.rpc ?? createRpcMetrics();
  const record: TrackedTransaction = {
    actionIndex: options.actionIndex,
    botId: options.botId,
    exploreRequested: options.exploreRequested,
    gameId: options.gameId,
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

  let submission: HarnessSubmission;
  let transactionHash: string;
  try {
    const submitStartedAtMs = Date.now();
    record.submitStartedAt = toIso(submitStartedAtMs);
    submission = await options.send();
    const submittedAtMs = Date.now();
    transactionHash = normalizeTransactionHash(submission.transactionHash);
    record.transactionHash = transactionHash;
    record.submittedAt = toIso(submittedAtMs);
    record.submitMs = submittedAtMs - submitStartedAtMs;
    if (options.scheduledAtMs !== undefined) record.submitDelayMs = Math.max(0, submittedAtMs - options.scheduledAtMs);
  } catch (error) {
    record.error = errorMessage(error);
    record.rpc = snapshotRpcMetrics(rpc);
    return record;
  }

  // The receipt lifecycle is the measurement (pre-confirmed and L2 timings at the poll boundary); the client's own
  // confirmation rides alongside so a bot never plans its next step before the client processed this one.
  const timeoutMs = transactionTimeoutMs(options.stage);
  const [lifecycle] = await Promise.all([
    waitForReceiptLifecycle(options.provider, transactionHash, Date.parse(record.submittedAt!), timeoutMs, rpc),
    settleQuietly(submission.confirmed),
  ]);
  Object.assign(record, lifecycle);
  record.rpc = snapshotRpcMetrics(rpc);
  return record;
}

/** An action's rejection is the same revert the receipt lifecycle records, so only its completion matters here. */
const settleQuietly = (confirmed: Promise<unknown> | undefined): Promise<void> =>
  confirmed
    ? confirmed.then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve();

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
        const receipt = (await measureRpc(rpc, "getTransactionReceipt", () =>
          provider.getTransactionReceipt(transactionHash),
        )) as { block_number?: number };
        if (!Number.isSafeInteger(receipt.block_number)) {
          throw new Error(`Accepted transaction ${transactionHash} has no block number`);
        }
        return {
          acceptedOnL2At: toIso(observedAtMs),
          acceptedOnL2Block: receipt.block_number,
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

async function waitForSettlement(game: HarnessGame, address: string, gameType: HarnessGameType): Promise<ID[]> {
  const structureIds = await game.waitFor(
    () => game.settlementStructureIds(address),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Settlement for ${address} in game ${game.gameId}`,
  );
  const expected = settlementStructureCount(gameType);
  if (structureIds.length !== expected) {
    throw new Error(`Expected ${expected} structures for ${address}, found ${structureIds.length}`);
  }
  return structureIds;
}

async function waitForStructures(game: HarnessGame, structureIds: ID[]): Promise<StructureState[]> {
  const mapCenter = game.mapCenter();
  return game.waitFor(
    () =>
      collectAll(structureIds, (structureId) => {
        const coord = game.structureCoord(structureId);
        return coord && { coord, direction: chooseOutwardDirection(coord, mapCenter), structureId };
      }),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Structures ${structureIds.join(", ")}`,
  );
}

async function waitForStartingTroopTypes(game: HarnessGame, structureIds: ID[]): Promise<Map<ID, TroopType>> {
  const troopTypes = await game.waitFor(
    () => collectAll(structureIds, (structureId) => game.startingTroopType(structureId)),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Resources of structures ${structureIds.join(", ")}`,
  );
  return new Map(structureIds.map((structureId, index) => [structureId, troopTypes[index]!]));
}

async function waitForExplorers(game: HarnessGame, structures: StructureState[]): Promise<ExplorerState[]> {
  return game.waitFor(
    () =>
      collectAll(structures, (structure) => {
        const explorerId = game.explorerOf(structure.structureId);
        return explorerId === undefined ? undefined : buildExplorerState(structure, explorerId);
      }),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Explorers of structures ${structures.map(({ structureId }) => structureId).join(", ")}`,
  );
}

/** Every item resolved, or nothing yet: the shape a RECS wait needs for a set of rows that land independently. */
function collectAll<T, R>(items: readonly T[], read: (item: T) => R | undefined): R[] | undefined {
  const collected: R[] = [];
  for (const item of items) {
    const value = read(item);
    if (value === undefined) return undefined;
    collected.push(value);
  }
  return collected;
}

function buildExplorerState(structure: StructureState, explorerId: ID): ExplorerState {
  return {
    atFrontier: true,
    blockedDirections: new Map(),
    explorerId,
    lastUsedAt: -1,
    outwardDirection: structure.direction,
    pathDirections: [],
    structureId: structure.structureId,
  };
}

function requireExplorer(game: HarnessGame, explorerId: ID): ExplorerRow {
  const explorer = game.explorer(explorerId);
  if (!explorer) throw new Error(`Explorer ${explorerId} is not in RECS`);
  return explorer;
}

function requireProduction(game: HarnessGame, structureId: ID): ProductionState {
  const production = game.production(structureId);
  if (!production) throw new Error(`Resource ${structureId} is not in RECS`);
  return production;
}

const changedExplorer = (before: ExplorerRow, current: ExplorerRow | undefined): ExplorerRow | undefined =>
  current &&
  (current.coord.x !== before.coord.x ||
    current.coord.y !== before.coord.y ||
    current.staminaAmount !== before.staminaAmount ||
    current.staminaUpdatedTick !== before.staminaUpdatedTick)
    ? current
    : undefined;

const changedProduction = (
  before: ProductionState,
  current: ProductionState | undefined,
): ProductionState | undefined =>
  current && (current.laborBalance !== before.laborBalance || current.woodOutput !== before.woodOutput)
    ? current
    : undefined;

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
  gameId,
  kind,
  rpc,
  scheduledAtMs,
  tick,
}: {
  actionIndex: number;
  botId: number;
  error: unknown;
  gameId: number;
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
    failureClass: classifyWorkloadFailure(error),
    gameId,
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

export function classifyWorkloadFailure(error: unknown): WorkloadFailureClass {
  if (error instanceof GameRuleLimitError) return "game_rule_limit";
  if (error instanceof HarnessPathingError) return "harness_pathing";
  const message = errorMessage(error);
  if (
    /(?:insufficient|not enough|requires?).*stamina|no explorer has \d+ stamina|stamina.*(?:depleted|required)/i.test(
      message,
    ) ||
    /(?:insufficient|not enough).*labor|labor.*(?:depleted|required)/i.test(message)
  ) {
    return "game_rule_limit";
  }
  if (/occupied|collision|no .*path|no .*route|path.*not explored|unoccupied exploration direction/i.test(message)) {
    return "harness_pathing";
  }
  return "chain_or_driver";
}

export function classifyWorkloadRevertReason(error: unknown): WorkloadRevertReason {
  const message = errorMessage(error);
  if (/one of the tiles in path is occupied|tile.*occupied/i.test(message)) return "tile_contention";
  if (/stamina/i.test(message)) return "stamina";
  if (/labor/i.test(message)) return "labor";
  return "other";
}

function classifyTransactionFailure(transaction: TrackedTransaction): void {
  if (transaction.outcome === "completed") return;
  transaction.failureClass = classifyWorkloadFailure(transaction.error);
  if (transaction.outcome === "reverted" || transaction.outcome === "rejected") {
    transaction.revertReason = classifyWorkloadRevertReason(transaction.error);
  }
}

export function createRpcMetrics(): RpcMetrics {
  return {
    estimateInvokeFee: { calls: 0, wallMs: 0 },
    getBlock: { calls: 0, wallMs: 0 },
    getTransactionReceipt: { calls: 0, wallMs: 0 },
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
    getTransactionReceipt: snapshotRpcMethod(rpc.getTransactionReceipt),
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

export function cubeDistance(left: Coord, right: Coord): number {
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
