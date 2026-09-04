import { setTimeout as sleep } from "node:timers/promises";
import { CallData, shortString, type Account, type Call, type RpcProvider } from "starknet";
import { buildBlitzSettleCalls } from "../../../apps/game/src/services/blitz/blitz-settlement-calls";
import { resolveGameTransactionResourceBounds } from "../../../packages/core/src/account/transaction-resource-bounds";
import { Biome } from "../../../packages/core/src/utils/biome/biome";
import { BiomeType } from "../../../packages/types/src/constants/hex";
import { mapWithConcurrency, type HarnessAccount } from "./account-factory";
import { HeraldObserver, type HeraldExplorer as ExplorerRow } from "./herald-observer";

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
  blitzRealm: string;
  prizeDistribution: string;
  production: string;
  troopManagement: string;
  troopMovement: string;
}

export interface HarnessBot {
  account: Account;
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

interface ExplorerState {
  atFrontier: boolean;
  blockedDirections: Map<string, Set<number>>;
  coord: Coord;
  explorerId: string;
  lastUsedAt: number;
  outwardDirection: number;
  pathDirections: number[];
  stamina: number;
  staminaUpdatedTick: number;
  structureId: string;
  troopType: CairoTroopType;
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

type CairoTroopType = 0 | 1 | 2;

interface ExplorerPriority {
  atFrontier: boolean;
  lastUsedAt: number;
}

interface PrepareHarnessBotsOptions {
  accounts: HarnessAccount[];
  beforeProvision?: () => Promise<void>;
  gameId: number;
  provider: RpcProvider;
  setupConcurrency?: number;
  setupTransactions: TrackedTransaction[];
  systems: HarnessSystemAddresses;
  heraldUrl: string;
}

interface RunWorkloadOptions {
  bots: HarnessBot[];
  intervalSeconds: number;
  minutes: number;
  onTick?: (completedTicks: number, totalTicks: number) => void;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
  heraldUrl: string;
}

interface ExplorerActionPlan {
  calls: Call[];
  direction: number;
  explorer: ExplorerState;
  target: Coord;
}

interface PathReservation {
  explorerId: string;
  from: Coord;
  target: Coord;
}

interface TrackTransactionOptions {
  account: Account;
  actionIndex?: number;
  botId: number;
  calls: Call | Call[];
  exploreRequested?: boolean;
  gameId: number;
  kind: string;
  provider: RpcProvider;
  rpc?: RpcMetrics;
  scheduledAtMs?: number;
  stage: TransactionStage;
  tick?: number;
}

const CENTER_COORD = 2_147_483_646;
const ARMY_TICK_SECONDS = 60;
const STAMINA_GAIN_PER_TICK = 30;
const STAMINA_MAX = 120;
const EXPLORE_STAMINA_COST = 30;
const MOVE_STAMINA_COST = 20;
const PALADIN_TROOP_TYPE: CairoTroopType = 1;
const PALADIN_FAVORED_TRAVEL_BIOMES = new Set([
  BiomeType.Bare,
  BiomeType.Tundra,
  BiomeType.TemperateDesert,
  BiomeType.Shrubland,
  BiomeType.Grassland,
  BiomeType.SubtropicalDesert,
]);
const PALADIN_UNFAVORED_TRAVEL_BIOMES = new Set([
  BiomeType.Taiga,
  BiomeType.TemperateDeciduousForest,
  BiomeType.TemperateRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.TropicalRainForest,
]);
const EXPLORER_COUNT_PER_BOT = 3;
const EXPLORER_TROOP_AMOUNT = 10_000_000_000n;
const WOOD_RESOURCE_ID = 3;
export const RECEIPT_POLL_INTERVAL_MS = 50;
export const FIRST_ACTION_REQUIRED_STAMINA = EXPLORE_STAMINA_COST;
const TRANSACTION_TIMEOUT_MS = 30_000;
const SETUP_TRANSACTION_TIMEOUT_MS = 120_000;
const MODEL_UPDATE_TIMEOUT_MS = 30_000;
const ACTION_READINESS_TIMEOUT_MS = 360_000;
const ACTION_READINESS_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SETUP_CONCURRENCY = 6;
const MADARA_RESOURCE_BOUNDS = resolveGameTransactionResourceBounds("madara");

class GameRuleLimitError extends Error {}
class HarnessPathingError extends Error {}

class PathReservations {
  private readonly occupiedByExplorer = new Map<string, string>();
  private readonly reservedByExplorer = new Map<string, string>();
  private readonly structureCoords = new Set<string>();

  constructor(bots: readonly HarnessBot[]) {
    for (const bot of bots) {
      for (const structure of bot.structures) this.structureCoords.add(coordKey(structure.coord));
      for (const explorer of bot.explorers) {
        const key = coordKey(explorer.coord);
        const occupant = this.occupiedByExplorer.get(key);
        if (occupant) throw new Error(`Explorers ${occupant} and ${explorer.explorerId} share ${key}`);
        this.occupiedByExplorer.set(key, explorer.explorerId);
      }
    }
  }

  canReserve(explorerId: string, target: Coord): boolean {
    const key = coordKey(target);
    if (this.structureCoords.has(key)) return false;
    const occupant = this.occupiedByExplorer.get(key);
    if (occupant && occupant !== explorerId) return false;
    const reservation = this.reservedByExplorer.get(key);
    return !reservation || reservation === explorerId;
  }

  reserve(explorer: ExplorerState, target: Coord): PathReservation {
    if (!this.canReserve(explorer.explorerId, target)) {
      throw new HarnessPathingError(`Explorer ${explorer.explorerId} target ${coordKey(target)} is occupied`);
    }
    this.reservedByExplorer.set(coordKey(target), explorer.explorerId);
    return { explorerId: explorer.explorerId, from: explorer.coord, target };
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
  accounts,
  beforeProvision,
  gameId,
  provider,
  setupConcurrency = DEFAULT_SETUP_CONCURRENCY,
  setupTransactions,
  systems,
  heraldUrl,
}: PrepareHarnessBotsOptions): Promise<HarnessBot[]> {
  const heraldObserver = new HeraldObserver(heraldUrl, "madara");
  const mapCenter = await readMapCenter(heraldObserver, gameId);

  await mapWithConcurrency(accounts, setupConcurrency, async (harnessAccount) => {
    const settle = await settleBot({ harnessAccount, gameId, provider, systems });
    setupTransactions.push(settle);
    assertCompleted(settle);
  });

  await beforeProvision?.();

  return mapWithConcurrency(accounts, setupConcurrency, async (harnessAccount) => {
    const structureIds = await readSettlementStructureIds(heraldObserver, gameId, harnessAccount.address);
    const structures = await readStructures(heraldObserver, gameId, structureIds, mapCenter);

    const provision = await provisionBot({
      account: harnessAccount.account,
      botId: harnessAccount.botId,
      gameId,
      provider,
      structureIds,
      systems,
    });
    setupTransactions.push(provision);
    assertCompleted(provision);

    const troopTypes = await readStartingTroopTypes(heraldObserver, gameId, structureIds);

    const createExplorers = await createBotExplorers({
      account: harnessAccount.account,
      botId: harnessAccount.botId,
      gameId,
      provider,
      structures,
      systems,
      troopTypes,
    });
    setupTransactions.push(createExplorers);
    assertCompleted(createExplorers);

    const explorerRows = await readExplorers(heraldObserver, gameId, structureIds);
    const explorers = structures.map((structure) => {
      const troopType = troopTypes.get(structure.structureId);
      if (troopType === undefined)
        throw new Error(`No troop type is configured for structure ${structure.structureId}`);
      return buildExplorerState(structure, explorerRows, troopType);
    });

    return {
      account: harnessAccount.account,
      address: harnessAccount.address,
      botId: harnessAccount.botId,
      explorers,
      gameId,
      nextProductionStructure: 0,
      structures,
    };
  });
}

export async function runWorkload({
  bots,
  intervalSeconds,
  minutes,
  onTick,
  provider,
  systems,
  heraldUrl,
}: RunWorkloadOptions): Promise<WorkloadResult> {
  const ticks = resolveWorkloadTicks(minutes, intervalSeconds);
  const overheadRpc = createRpcMetrics();
  const readinessWaitMs = await waitForEveryBotToHaveActionStamina(provider, bots, overheadRpc);

  const workloadStartedAtMs = Date.now();
  const actions: TrackedTransaction[] = [];
  const botQueues = new Map(bots.map((bot) => [bot.botId, Promise.resolve()]));
  const botSpacingMs = (intervalSeconds * 1_000) / bots.length;
  const pathReservations = createPathReservationsByGame(bots);
  const heraldObserver = new HeraldObserver(heraldUrl, "madara");

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
            gameId: bot.gameId,
            kind: resolveActionKind(tick),
            pathReservations: pathReservations.get(bot.gameId)!,
            provider,
            rpc,
            scheduledAtMs,
            systems,
            tick,
            heraldObserver,
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

export function resolveExplorerActionStaminaCost(
  kind: "move" | "explore",
  biome: BiomeType,
  troopType: CairoTroopType,
): number {
  if (kind === "explore") return EXPLORE_STAMINA_COST;
  if (biome === BiomeType.DeepOcean || biome === BiomeType.Ocean) return MOVE_STAMINA_COST - 10;
  if (biome === BiomeType.Scorched) return MOVE_STAMINA_COST + 10;
  if (troopType !== PALADIN_TROOP_TYPE) return MOVE_STAMINA_COST;
  if (PALADIN_FAVORED_TRAVEL_BIOMES.has(biome)) {
    return MOVE_STAMINA_COST - 10;
  }
  if (PALADIN_UNFAVORED_TRAVEL_BIOMES.has(biome)) {
    return MOVE_STAMINA_COST + 10;
  }
  return MOVE_STAMINA_COST;
}

export function resolveWorkloadTicks(minutes: number, intervalSeconds: number): number {
  return Math.ceil((minutes * 60) / intervalSeconds);
}

export function hasExplorerWithStamina(
  explorers: readonly { stamina: number; staminaUpdatedTick: number }[],
  chainTick: number,
  requiredStamina: number,
): boolean {
  return explorers.some((explorer) => estimatedStamina(explorer, chainTick) >= requiredStamina);
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
    // Preserve compatibility with historical string encodings in saved fixtures.
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
  return [...candidates].sort((left, right) => {
    const frontierPriority = kind === "move" ? Number(left.atFrontier) - Number(right.atFrontier) : 0;
    return frontierPriority || left.lastUsedAt - right.lastUsedAt;
  })[0];
}

async function settleBot({
  harnessAccount,
  gameId,
  provider,
  systems,
}: {
  harnessAccount: HarnessAccount;
  gameId: number;
  provider: RpcProvider;
  systems: HarnessSystemAddresses;
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
    gameId,
    kind: "settle",
    provider,
    stage: "setup",
  });
}

async function provisionBot({
  account,
  botId,
  gameId,
  provider,
  structureIds,
  systems,
}: {
  account: Account;
  botId: number;
  gameId: number;
  provider: RpcProvider;
  structureIds: string[];
  systems: HarnessSystemAddresses;
}): Promise<TrackedTransaction> {
  return trackTransaction({
    account,
    botId,
    calls: structureIds.map((structureId) => ({
      contractAddress: systems.blitzRealm,
      entrypoint: "provision_realm",
      calldata: CallData.compile([gameId, structureId]),
    })),
    gameId,
    kind: "provision",
    provider,
    stage: "setup",
  });
}

async function createBotExplorers({
  account,
  botId,
  gameId,
  provider,
  structures,
  systems,
  troopTypes,
}: {
  account: Account;
  botId: number;
  gameId: number;
  provider: RpcProvider;
  structures: StructureState[];
  systems: HarnessSystemAddresses;
  troopTypes: Map<string, number>;
}): Promise<TrackedTransaction> {
  return trackTransaction({
    account,
    botId,
    calls: structures.map(({ direction, structureId }) => {
      const troopType = troopTypes.get(structureId);
      if (troopType === undefined) throw new Error(`No starting troop type exists for structure ${structureId}`);
      return {
        contractAddress: systems.troopManagement,
        entrypoint: "explorer_create",
        calldata: CallData.compile([gameId, structureId, troopType, 0, EXPLORER_TROOP_AMOUNT, direction]),
      };
    }),
    gameId,
    kind: "create-explorers",
    provider,
    stage: "setup",
  });
}

interface RunBotActionOptions {
  actionIndex: number;
  bot: HarnessBot;
  gameId: number;
  kind: WorkloadActionKind;
  pathReservations: PathReservations;
  provider: RpcProvider;
  rpc: RpcMetrics;
  scheduledAtMs: number;
  systems: HarnessSystemAddresses;
  tick: number;
  heraldObserver: HeraldObserver;
}

type ExecuteBotActionOptions = RunBotActionOptions & { chainTick: number };

async function runBotAction(options: RunBotActionOptions): Promise<TrackedTransaction> {
  try {
    const chainTick = await readCurrentArmyTick(options.provider, options.rpc);
    const transaction = await executeBotAction({ ...options, chainTick });
    classifyTransactionFailure(transaction);
    return transaction;
  } catch (error) {
    const { actionIndex, bot, gameId, kind, rpc, scheduledAtMs, tick } = options;
    return driverFailure({ actionIndex, botId: bot.botId, error, gameId, kind, rpc, scheduledAtMs, tick });
  }
}

async function executeBotAction(options: ExecuteBotActionOptions): Promise<TrackedTransaction> {
  if (options.kind === "produce") return runProductionAction(options);
  return runExplorerAction({ ...options, kind: options.kind });
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
  heraldObserver,
}: Omit<ExecuteBotActionOptions, "chainTick" | "kind" | "pathReservations">): Promise<TrackedTransaction> {
  const structure = bot.structures[bot.nextProductionStructure % bot.structures.length]!;
  bot.nextProductionStructure += 1;
  const resourceBefore = await heraldObserver.readResource(gameId, structure.structureId);

  const transaction = await trackTransaction({
    account: bot.account,
    actionIndex,
    botId: bot.botId,
    calls: {
      contractAddress: systems.production,
      entrypoint: "burn_labor_for_resource_production",
      calldata: CallData.compile([gameId, structure.structureId, [1], [WOOD_RESOURCE_ID]]),
    },
    gameId,
    kind: "produce",
    provider,
    rpc,
    scheduledAtMs,
    stage: "workload",
    tick,
  });
  if (transaction.outcome !== "completed") {
    return transaction;
  }

  try {
    const resourceAfter = await heraldObserver.waitForResource(
      gameId,
      structure.structureId,
      resourceBefore,
      requiredAcceptedBlock(transaction),
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
    transaction.failureClass = "chain_or_driver";
  }
  return transaction;
}

async function runExplorerAction({
  actionIndex,
  bot,
  chainTick,
  gameId,
  kind,
  pathReservations,
  provider,
  rpc,
  scheduledAtMs,
  systems,
  tick,
  heraldObserver,
}: ExecuteBotActionOptions & { kind: "move" | "explore" }): Promise<TrackedTransaction> {
  const plan = planExplorerAction(bot, kind, chainTick, gameId, systems.troopMovement, pathReservations);
  const selectedExplorer = plan.explorer;
  const previousCoord = selectedExplorer.coord;
  selectedExplorer.lastUsedAt = actionIndex;
  const reservation = pathReservations.reserve(selectedExplorer, plan.target);

  const transaction = await trackTransaction({
    account: bot.account,
    actionIndex,
    botId: bot.botId,
    calls: plan.calls,
    exploreRequested: kind === "explore",
    gameId,
    kind,
    provider,
    rpc,
    scheduledAtMs,
    stage: "workload",
    tick,
  });
  if (transaction.outcome !== "completed") {
    pathReservations.cancel(reservation);
    return transaction;
  }

  try {
    const updated = await heraldObserver.waitForExplorer(
      gameId,
      selectedExplorer.explorerId,
      selectedExplorer,
      requiredAcceptedBlock(transaction),
      MODEL_UPDATE_TIMEOUT_MS,
    );
    pathReservations.complete(reservation, { x: updated.x, y: updated.y });
    applyExplorerUpdate(selectedExplorer, kind, plan.direction, previousCoord, updated);
  } catch (error) {
    pathReservations.complete(reservation, plan.target);
    transaction.outcome = "driver_failed";
    transaction.error = errorMessage(error);
    transaction.failureClass = "chain_or_driver";
  }
  return transaction;
}

function planExplorerAction(
  bot: HarnessBot,
  kind: "move" | "explore",
  chainTick: number,
  gameId: number,
  troopMovementAddress: string,
  pathReservations: PathReservations,
): ExplorerActionPlan {
  const routeReady = bot.explorers.filter((explorer) =>
    kind === "explore" ? explorerAtFrontier(explorer) : explorer.pathDirections.length > 0,
  );
  const remaining = [...routeReady];
  let minimumRequiredStamina = Number.POSITIVE_INFINITY;
  while (remaining.length > 0) {
    const explorer = prioritizeExplorer(remaining, kind)!;
    remaining.splice(remaining.indexOf(explorer), 1);
    const directions =
      kind === "explore" ? chooseExploreDirections(explorer, bot.structures) : [chooseMoveDirection(explorer)];
    for (const direction of directions) {
      const target = neighbor(explorer.coord, direction);
      if (!pathReservations.canReserve(explorer.explorerId, target)) continue;
      const staminaCost = resolveExplorerActionStaminaCost(
        kind,
        Biome.getBiome(target.x, target.y),
        explorer.troopType,
      );
      minimumRequiredStamina = Math.min(minimumRequiredStamina, staminaCost);
      if (estimatedStamina(explorer, chainTick) < staminaCost) continue;
      return {
        calls: buildExplorerCalls(explorer.explorerId, direction, kind === "explore", gameId, troopMovementAddress),
        direction,
        explorer,
        target,
      };
    }
  }

  if (Number.isFinite(minimumRequiredStamina)) {
    throw new GameRuleLimitError(
      `No explorer has enough route-adjusted stamina for ${kind}; minimum route cost is ${minimumRequiredStamina}`,
    );
  }
  const routeState = bot.explorers
    .map(
      (explorer) =>
        `${explorer.explorerId}@${coordKey(explorer.coord)} path=${explorer.pathDirections.length} blocked=${[
          ...(explorer.blockedDirections.get(coordKey(explorer.coord)) ?? []),
        ].join(",")}`,
    )
    .join("; ");
  throw new HarnessPathingError(
    `No collision-free ${kind} route is available for bot ${bot.botId}: ${routeState}`,
  );
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

async function waitForEveryBotToHaveActionStamina(
  provider: RpcProvider,
  bots: HarnessBot[],
  rpc: RpcMetrics,
): Promise<number> {
  const startedAtMs = Date.now();
  const deadline = startedAtMs + ACTION_READINESS_TIMEOUT_MS;

  while (Date.now() <= deadline) {
    const chainTick = await readCurrentArmyTick(provider, rpc);
    const everyBotReady = bots.every((bot) => {
      return hasExplorerWithStamina(bot.explorers, chainTick, FIRST_ACTION_REQUIRED_STAMINA);
    });
    if (everyBotReady) return Date.now() - startedAtMs;
    await sleep(ACTION_READINESS_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Every bot did not gain ${FIRST_ACTION_REQUIRED_STAMINA} explorer stamina within 360 seconds of chain time`,
  );
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

  let transactionHash: string;
  try {
    const submitStartedAtMs = Date.now();
    record.submitStartedAt = toIso(submitStartedAtMs);
    const submitted = await options.account.execute(options.calls, {
      resourceBounds: MADARA_RESOURCE_BOUNDS,
      tip: 0,
    });
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
  Object.assign(
    record,
    await waitForReceiptLifecycle(options.provider, transactionHash, Date.parse(record.submittedAt!), timeoutMs, rpc),
  );
  record.rpc = snapshotRpcMetrics(rpc);
  return record;
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

async function readMapCenter(observer: HeraldObserver, gameId: number): Promise<Coord> {
  const rows = (await observer.readModelRows(gameId, ["WorldConfig"])).get("WorldConfig")!;
  const row = rows[0];
  if (!row) throw new Error(`WorldConfig ${gameId} is absent from Herald`);
  const coordinate = CENTER_COORD - asNumber(row.map_center_offset, "WorldConfig.map_center_offset");
  return { x: coordinate, y: coordinate };
}

async function readSettlementStructureIds(
  observer: HeraldObserver,
  gameId: number,
  address: string,
): Promise<string[]> {
  const rows = (
    await observer.waitForModelRows(
      gameId,
      ["BlitzSettlement"],
      (models) => models.get("BlitzSettlement")!.some((candidate) => feltEquals(candidate.player, address)),
      MODEL_UPDATE_TIMEOUT_MS,
    )
  ).get("BlitzSettlement")!;
  const row = rows.find((candidate) => feltEquals(candidate.player, address));
  if (!row) throw new Error(`Settlement for ${address} in game ${gameId} is absent from Herald`);
  const structureIds = parseStructureIds(row.structure_ids);
  if (structureIds.length !== EXPLORER_COUNT_PER_BOT) {
    throw new Error(`Expected ${EXPLORER_COUNT_PER_BOT} structures for ${address}, found ${structureIds.length}`);
  }
  return structureIds;
}

async function readStructures(
  observer: HeraldObserver,
  gameId: number,
  structureIds: string[],
  mapCenter: Coord,
): Promise<StructureState[]> {
  const requestedIds = new Set(structureIds);
  const rows = (
    await observer.waitForModelRows(
      gameId,
      ["Structure"],
      (models) =>
        models.get("Structure")!.filter((row) => requestedIds.has(parseEntityId(row.entity_id))).length ===
        structureIds.length,
      MODEL_UPDATE_TIMEOUT_MS,
    )
  )
    .get("Structure")!
    .filter((row) => requestedIds.has(parseEntityId(row.entity_id)));
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected ${structureIds.length} structures in Herald, found ${rows.length}`);
  }

  const byId = new Map(rows.map((row) => [parseEntityId(row.entity_id), asRecord(row.base, "Structure.base")]));
  return structureIds.map((structureId) => {
    const base = byId.get(structureId);
    if (!base) throw new Error(`Structure ${structureId} is absent from Herald`);
    const coord = {
      x: asNumber(base.coord_x, "Structure.base.coord_x"),
      y: asNumber(base.coord_y, "Structure.base.coord_y"),
    };
    return { coord, direction: chooseOutwardDirection(coord, mapCenter), structureId };
  });
}

async function readExplorers(observer: HeraldObserver, gameId: number, structureIds: string[]): Promise<ExplorerRow[]> {
  const requestedOwners = new Set(structureIds);
  await observer.waitForModelRows(
    gameId,
    ["ExplorerTroops"],
    (models) =>
      models.get("ExplorerTroops")!.filter((row) => requestedOwners.has(parseEntityId(row.owner))).length ===
      structureIds.length,
    MODEL_UPDATE_TIMEOUT_MS,
  );
  const rows = (await observer.readExplorers(gameId)).filter((row) => requestedOwners.has(row.owner));
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected ${structureIds.length} explorers in Herald, found ${rows.length}`);
  }
  return rows;
}

async function readStartingTroopTypes(
  observer: HeraldObserver,
  gameId: number,
  structureIds: string[],
): Promise<Map<string, number>> {
  const requestedIds = new Set(structureIds);
  const rows = (
    await observer.waitForModelRows(
      gameId,
      ["Resource"],
      (models) =>
        models.get("Resource")!.filter((row) => requestedIds.has(parseEntityId(row.entity_id))).length ===
        structureIds.length,
      MODEL_UPDATE_TIMEOUT_MS,
    )
  )
    .get("Resource")!
    .filter((row) => requestedIds.has(parseEntityId(row.entity_id)));
  if (rows.length !== structureIds.length) {
    throw new Error(`Expected resources for ${structureIds.length} structures in Herald, found ${rows.length}`);
  }

  return new Map(
    rows.map((row) => {
      const balances = [row.KNIGHT_T1_BALANCE, row.PALADIN_T1_BALANCE, row.CROSSBOWMAN_T1_BALANCE];
      const troopType = balances.findIndex((balance) => BigInt(balance) >= EXPLORER_TROOP_AMOUNT);
      if (troopType < 0) throw new Error(`Structure ${row.entity_id} has no funded T1 troop type`);
      return [parseEntityId(row.entity_id), troopType];
    }),
  );
}

function buildExplorerState(structure: StructureState, rows: ExplorerRow[], troopType: number): ExplorerState {
  const row = rows.find((candidate) => candidate.owner === structure.structureId);
  if (!row) throw new Error(`Explorer for structure ${structure.structureId} is absent from Herald`);
  return {
    atFrontier: true,
    blockedDirections: new Map(),
    coord: { x: row.x, y: row.y },
    explorerId: row.explorerId,
    lastUsedAt: -1,
    outwardDirection: structure.direction,
    pathDirections: [],
    stamina: row.stamina,
    staminaUpdatedTick: row.staminaUpdatedTick,
    structureId: structure.structureId,
    troopType: parseCairoTroopType(troopType),
  };
}

function parseCairoTroopType(value: number): CairoTroopType {
  if (value === 0 || value === 1 || value === 2) return value;
  throw new Error(`Unknown Cairo troop type ${value}`);
}

function assertCompleted(transaction: TrackedTransaction): void {
  if (transaction.outcome !== "completed") {
    throw new Error(
      `Bot ${transaction.botId} ${transaction.kind} failed (${transaction.outcome}): ${transaction.error ?? "unknown error"}`,
    );
  }
}

function requiredAcceptedBlock(transaction: TrackedTransaction): number {
  if (transaction.acceptedOnL2Block === undefined) {
    throw new Error(`Completed transaction ${transaction.transactionHash ?? "unknown"} has no accepted block`);
  }
  return transaction.acceptedOnL2Block;
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

function createPathReservationsByGame(bots: readonly HarnessBot[]): Map<number, PathReservations> {
  const botsByGame = new Map<number, HarnessBot[]>();
  for (const bot of bots) {
    const gameBots = botsByGame.get(bot.gameId) ?? [];
    gameBots.push(bot);
    botsByGame.set(bot.gameId, gameBots);
  }
  return new Map([...botsByGame].map(([gameId, gameBots]) => [gameId, new PathReservations(gameBots)]));
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

function parseEntityId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Invalid entity id ${String(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`Invalid entity id ${String(value)}`);
  return parsed.toString();
}

function feltEquals(left: unknown, right: unknown): boolean {
  try {
    return BigInt(left as string | number | bigint) === BigInt(right as string | number | bigint);
  } catch {
    return false;
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Herald ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, field: string): number {
  const parsed = Number(BigInt(value as string | number | bigint));
  if (!Number.isSafeInteger(parsed)) throw new Error(`Herald ${field} must be a safe integer`);
  return parsed;
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
