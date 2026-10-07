import { attachAcceptedBlocks } from "./gas-collector";
import { setTimeout as sleep } from "node:timers/promises";
import type { Account } from "starknet";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { fetchHeraldGameHistory } from "@bibliothecadao/eternum/game-client";
import {
  ArmyActionManager,
  canPayTroopRaise,
  realmLearned,
  researchedDepth,
  researchRowCategory,
  researchTier,
  createGameActions,
  configManager,
  getBuildingCosts,
  dayOf,
  DAY_UNITS_PER_BAG,
  DAYS_PER_BAG,
  getBlockTimestamp,
  getTileAt,
  entityMapPosition,
  liveHomeArmies,
  readExpeditionRules,
  readTroopRaiseCost,
  ResourceManager,
  seasonSeconds,
  type GameClient,
  waitForWorldState,
} from "@bibliothecadao/eternum";
import { generateBuildablePositions } from "@bibliothecadao/eternum/automation";
import {
  BUILDINGS_CENTER,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TroopTier,
} from "@bibliothecadao/types";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import {
  nativeResearchConstants as research,
  type NativeRows,
} from "../../../contracts/l3/world-native/schema/client.gen";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { nativePresetForId } from "../../../config/source/native";
import { FRONTIER_ACCELERATED_PRESET_ID } from "../../../config/source/common/native-preset-modes";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import {
  buildNativeGameParams,
  buildNativePresetRegistration,
  loadNativePresetConfiguration,
  registerNativePreset,
} from "../../../config/deployer/clean/registrar/native-preset";
import type { HarnessAccount } from "./account-factory";
import { actorKey, type HarnessGameClient } from "./game-client";
import { createRpcMetrics, trackTransaction, type TrackedTransaction, type WorkloadResult } from "./driver";
import type { HarnessGame } from "./harness-game";
import type { HarnessProvider } from "./provider";
import { known } from "./known";
import {
  expectedWheat,
  presetRates,
  wheatCharged,
  type FrontierRuleEvidence,
  type WheatCharge,
  type WheatState,
} from "./frontier-rules";

// Frontier's own day unit: the evidence's time scale is how much faster a run's unit is.
const DESIGN_DAY_UNIT_SECONDS = 14_400;
const precision = BigInt(RESOURCE_PRECISION);
/** Every guarded Frontier site an army may attack: camps, rifts, stragglers and the day's ruin. */
const GUARDED_SITES = new Set<number>([
  StructureType.Camp,
  StructureType.Rift,
  StructureType.Stragglers,
  StructureType.Ruin,
]);

/**
 * Creates a Frontier season from a registered preset. The design run creates from the accelerated fixture preset, which
 * it registers on first use; presets are immutable, so no run ever edits a mode's own preset to change its clocks.
 */
export async function launchFrontierSeason(
  provider: HarnessProvider,
  gameName: string,
  minutes: number,
  presetId: number,
) {
  const manifest = process.env.NATIVE_WORLD_MANIFEST;
  const address = process.env.DEPLOYER_ACCOUNT_ADDRESS;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!manifest || !address || !privateKey)
    throw new Error("Frontier launch requires the isolated manifest and authority");
  const account = createOperatorAccount(provider, address, privateKey);
  const config = loadNativePresetConfiguration("madara.frontier", presetId);
  const preset = buildNativePreset(config, presetId);
  if (nativePresetForId(presetId).clockScale) await registerFixturePreset(account, presetId, manifest, preset);
  // The season starts on an armies tick and lasts whole bags of days, covering the run and its longest last day.
  const tick = Number(preset.rules.tick_config.armies_tick_in_seconds);
  const startAt = Math.ceil((Math.floor(Date.now() / 1000) + 60) / tick) * tick;
  const unit = preset.rules.day_unit_seconds;
  const bags = Math.ceil((Math.ceil(minutes * 60) + 6 * unit) / seasonSeconds(1, unit));
  const params = buildNativeGameParams(config, {
    gameName,
    presetId,
    startMainAt: startAt,
    chainTimestamp: startAt - 60,
    durationSeconds: seasonSeconds(bags, unit),
    devModeOn: false,
    singleRealmMode: true,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  const created = await createRegistrarGame(account, params, "madara.frontier", preset);
  if (!created.gameId) throw new Error("Frontier registrar did not emit a game id");
  console.log(
    JSON.stringify({
      frontierSeason: created.gameId,
      presetId,
      dayUnitSeconds: unit,
      createTransaction: created.transactionHash,
    }),
  );
  // Open entry: Frontier has no settlement burst at start; players settle themselves during play.
  return { gameId: created.gameId, gameName, startAt, settlementTransactions: 0 };
}

/** Registers a fixture preset's definition under its own id; an already registered one is left as it is. */
async function registerFixturePreset(
  account: Account,
  presetId: number,
  manifest: string,
  definition: ReturnType<typeof buildNativePreset>,
): Promise<void> {
  const registration = buildNativePresetRegistration(definition, presetId, manifest);
  const transaction = await registerNativePreset(account, presetId, registration);
  console.log(JSON.stringify({ fixturePreset: presetId, commitment: registration.commitment, transaction }));
}

/** A design run's day unit: the accelerated fixture preset's, which the season it plays must match. */
const acceleratedDayUnitSeconds = (): number => {
  const preset = nativePresetForId(FRONTIER_ACCELERATED_PRESET_ID);
  return preset.dayUnitSeconds / preset.clockScale!;
};

type Army = NativeRows["ExplorerTroops"];
type Home = NativeRows["Structure"];
type Profile = "check-in" | "daily";
interface Day {
  epoch: number;
  startedAt: number;
  endedAt?: number;
  actions: number;
  explored: number;
  sessionExplores: Record<number, number>;
  captures: number;
  campCaptures: number;
  campAttempts: Array<{ armyId: number; siteId: number; lost: boolean }>;
  exchanges: number;
  attackStamina: number;
  otherStamina: number;
  armyIds: number[];
  layout: string;
}
interface Player {
  identity: HarnessAccount;
  /** The bot's own client and the game as it sees and acts on it. */
  client: GameClient;
  game: HarnessGame;
  realmId: number;
  profile: Profile;
  settledAt: number;
  firstCampAt?: number;
  days: Day[];
  rungs: Array<{ lane: string; level: number; at: number }>;
  rollovers: Array<{
    epoch: number;
    at: number;
    realmId: number;
    previousArmies: number[];
    currentArmies: number[];
    labor: string;
    wheat: string;
    essence: string;
    production: Array<{ resource: number; rate: string }>;
  }>;
  captures: Array<{ epoch: number; siteId: number; category: number; exchanges: number; at: number }>;
  siteExchanges: Map<number, number>;
  nextActionAt: number;
}
/**
 * A campaign burst on the Frontier shape: the booth, where every bot founds its realm inside the window, or the
 * rollover, where every bot musters and explores inside a new day's first window.
 */
export interface FrontierBurst {
  shape: "booth" | "rollover";
  windowSeconds: number;
}
export interface FrontierEvidence {
  burst?: FrontierBurst;
  /** A functional pass at the season's own speed: what it observed of its preset's rates and charges. */
  rules?: FrontierRuleEvidence;
  /** The mean day of a bag (20 units over 5 days), the length the summaries count days in. */
  meanDaySeconds: number;
  timeScale: number;
  players: Array<
    Omit<Player, "identity" | "siteExchanges" | "nextActionAt"> & {
      botId: number;
      owner: string;
      /** Each ruin the player cleared: its day and the whole LORDS its stored chest paid. */
      chests: Array<{ epoch: number; lords: number }>;
    }
  >;
}
interface RunFrontierOptions {
  /** A functional run: the design run on the accelerated preset, the real-speed rules pass on any other. */
  functional: boolean;
  burst?: FrontierBurst;
  setupConcurrency: number;
  onReady?: () => Promise<void>;
  /** Observes the season as a whole: its day length, epoch and chest history. */
  client: GameClient;
  actorClients: ReadonlyMap<string, HarnessGameClient>;
  game: HarnessGame;
  provider: HarnessProvider;
  accounts: HarnessAccount[];
  minutes: number;
  setupTransactions: TrackedTransaction[];
}

/** Decisions use the same synchronized native facts and command submission as a player. */
export async function runFrontierWorkload(options: RunFrontierOptions): Promise<WorkloadResult> {
  const { client, game, accounts } = options;
  const dayUnitSeconds = calendarOf(client).dayUnitSeconds;
  // A burst measures one moment of load, which is the same on any day length; the plain shape plays its own days.
  if (!options.burst && options.accelerated !== (dayUnitSeconds === acceleratedDayUnitSeconds()))
    throw new Error(
      `Frontier ${options.accelerated ? "design run" : "capacity shape"} does not match the season's day unit (${dayUnitSeconds} s)`,
    );
  const rules = options.functional && dayUnitSeconds !== acceleratedDayUnitSeconds() ? recordRules(client) : undefined;
  await game.waitUntilPlaying();
  if (options.burst?.shape === "booth") return runBoothBurst(options, dayUnitSeconds);
  const players = await settleFrontierPlayers(options, accounts);
  await Promise.all(players.map((player) => waitForRealmResources(player.client, player)));
  if (options.burst?.shape === "rollover") return runRolloverBurst(options, players, dayUnitSeconds);
  for (const player of players) observeDay(player);
  rules?.observeRates(players);
  await options.onReady?.();
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + options.minutes * 60000;
  const actions: TrackedTransaction[] = [];
  let ticks = 0;
  let failed = false;
  while (Date.now() < deadline && !failed) {
    await Promise.all(
      players.map(async (player) => {
        await waitForRealmResources(player.client, player);
        observeDay(player);
        if (now() < player.nextActionAt || !inSession(player.client, player)) return;
        const action = chooseAction(player.client, player.game, player);
        if (!action) return;
        const result = await playAction(options, player, action, undefined, rules);
        actions.push(result);
        player.nextActionAt = now() + 1;
        if (result.outcome !== "completed") {
          console.error(JSON.stringify({ frontierFailure: result }));
          failed = true;
        }
      }),
    );
    if (++ticks % 30 === 0)
      console.log(
        JSON.stringify({
          timestamp: now(),
          frontierProgress: players.map((player) => ({
            botId: player.identity.botId,
            profile: player.profile,
            day: currentDay(player),
            rungs: player.rungs,
          })),
        }),
      );
    await sleep(1000);
  }
  for (const player of players) currentDay(player).endedAt = now();
  return frontierResult(options, { players, actions, startedAt, ticks, dayUnitSeconds, rules: rules?.evidence });
}

type RuleRecorder = ReturnType<typeof recordRules>;

/** The real-speed pass's observations, against the preset its season was created from. */
function recordRules(client: GameClient) {
  const presetId = client.setup.store.require("GameRegistry", { game_id: client.gameId }).preset_id;
  const definition = buildNativePreset(loadNativePresetConfiguration("madara.frontier", presetId), presetId);
  const evidence: FrontierRuleEvidence = { rates: [], charges: [] };
  return {
    evidence,
    /** Each realm's production as founded, before any upgrade changes a building's tier. */
    observeRates(players: Player[]) {
      for (const { client: own, realmId } of players) {
        const rows = [...own.setup.store.inGame("ResourceProduction", own.gameId)].filter(
          (row) => row.entity_id === realmId,
        );
        evidence.rates.push(...presetRates(definition, rows));
      }
    },
    recordCharge(player: Player, charge: WheatCharge, before: WheatState, after: WheatState) {
      const charged = wheatCharged(before, after);
      if (charged === null) return;
      evidence.charges.push({
        botId: player.identity.botId,
        kind: charge.kind,
        troops: charge.troops.toString(),
        expected: expectedWheat(definition, charge).toString(),
        charged: charged.toString(),
      });
    },
  };
}

function wheatState(player: Player): WheatState {
  const manager = new ResourceManager(player.client.setup.store, player.realmId, player.client.gameId);
  return known(manager.current(ResourcesIds.Wheat), player.realmId, "wheat state");
}

/**
 * The booth burst: every bot founds its realm inside the window, released evenly across it, and the foundings are the
 * measured workload.
 */
async function runBoothBurst(options: RunFrontierOptions, dayUnitSeconds: number): Promise<WorkloadResult> {
  await options.onReady?.();
  const startedAt = new Date().toISOString();
  const releaseAtMs = Date.now();
  const spacingMs = (options.burst!.windowSeconds * 1000) / options.accounts.length;
  const founded = await Promise.all(
    options.accounts.map(async (identity, index) => {
      const scheduledAtMs = releaseAtMs + index * spacingMs;
      await sleep(Math.max(0, scheduledAtMs - Date.now()));
      return settleFrontierPlayer(options, identity, { stage: "workload", scheduledAtMs });
    }),
  );
  return frontierResult(options, {
    players: founded.flatMap(({ player }) => (player ? [player] : [])),
    actions: founded.map(({ transaction }) => transaction),
    startedAt,
    ticks: 0,
    dayUnitSeconds,
  });
}

/**
 * The rollover burst: once every bot is settled, the next day's boundary releases them evenly across the window, each
 * mustering a fresh army and sending it on its first move; the musters and moves are the measured workload.
 */
async function runRolloverBurst(
  options: RunFrontierOptions,
  players: Player[],
  dayUnitSeconds: number,
): Promise<WorkloadResult> {
  const { client } = options;
  // Workers sharing the season are all settled before any waits, so they wait for the same boundary.
  await options.onReady?.();
  const settledDay = today(client);
  console.log(JSON.stringify({ frontierRolloverWaitSeconds: settledDay.end - now() }));
  while (today(client).index === settledDay.index) await sleep(1000);
  for (const player of players) observeDay(player);
  const startedAt = new Date().toISOString();
  const releaseAtMs = Date.now();
  const spacingMs = (options.burst!.windowSeconds * 1000) / players.length;
  const actions = await Promise.all(
    players.map(async (player, index) => {
      const scheduledAtMs = releaseAtMs + index * spacingMs;
      await sleep(Math.max(0, scheduledAtMs - Date.now()));
      return playRollover(options, player, scheduledAtMs);
    }),
  );
  return frontierResult(options, { players, actions: actions.flat(), startedAt, ticks: 0, dayUnitSeconds });
}

/** One bot's rollover: a fresh army, then, once the army is in view, its first move of the day. */
async function playRollover(
  options: RunFrontierOptions,
  player: Player,
  scheduledAtMs: number,
): Promise<TrackedTransaction[]> {
  const muster = planMuster(player.client, player);
  if (!muster) return [];
  const mustered = await playAction(options, player, muster, scheduledAtMs);
  if (mustered.outcome !== "completed") return [mustered];
  const move = await waitForWorldState(
    player.client.setup.store,
    () => planExpedition(player.client, player.game, player),
    30_000,
    () => `bot ${player.identity.botId} has no move for its fresh army`,
  );
  return [mustered, await playAction(options, player, move, scheduledAtMs)];
}

async function playAction(
  { game, provider }: RunFrontierOptions,
  player: Player,
  action: Action,
  scheduledAtMs?: number,
  rules?: RuleRecorder,
): Promise<TrackedTransaction> {
  const before = rules && action.charge ? wheatState(player) : undefined;
  const result = await trackTransaction({
    botId: player.identity.botId,
    gameId: game.gameId,
    kind: action.kind,
    provider,
    stage: "workload",
    tick: currentDay(player).epoch,
    scheduledAtMs,
    send: () => player.game.submit(player.identity.account, action.run),
  });
  if (result.outcome !== "completed") return result;
  if (before) rules!.recordCharge(player, action.charge!, before, wheatState(player));
  currentDay(player).actions++;
  action.after?.();
  observeProgress(player.client, player.game, player);
  return result;
}

async function frontierResult(
  options: RunFrontierOptions,
  run: {
    players: Player[];
    actions: TrackedTransaction[];
    startedAt: string;
    ticks: number;
    dayUnitSeconds: number;
    rules?: FrontierRuleEvidence;
  },
): Promise<WorkloadResult> {
  const { client, provider } = options;
  const { players, actions, dayUnitSeconds } = run;
  await attachAcceptedBlocks(provider, actions);
  const chests = await readRuinChestHistory(
    client,
    Math.max(0, ...actions.map((action) => action.acceptedOnL2Block ?? 0)),
    epochSeconds,
  );
  const evidence: FrontierEvidence = {
    ...(options.burst ? { burst: options.burst } : {}),
    ...(run.rules ? { rules: run.rules } : {}),
    meanDaySeconds: (DAY_UNITS_PER_BAG / DAYS_PER_BAG) * dayUnitSeconds,
    timeScale: DESIGN_DAY_UNIT_SECONDS / dayUnitSeconds,
    players: players.map(({ identity, siteExchanges: _exchanges, nextActionAt: _next, ...player }) => ({
      ...player,
      botId: identity.botId,
      owner: identity.owner,
      chests: chests
        .filter((row) => row.player === BigInt(identity.address))
        .map(({ epoch, lords }) => ({ epoch, lords })),
    })),
  };
  return {
    profile: "frontier",
    frontier: evidence,
    actions,
    plannedActions: actions.length,
    overheadRpc: createRpcMetrics(),
    startedAt: run.startedAt,
    endedAt: new Date().toISOString(),
    ticks: run.ticks,
    readinessWaitMs: 0,
  };
}

/** A ruin's chest pays at its clear, as the LORDS reward of the ruin's SitePayout story. */
async function readRuinChestHistory(client: GameClient, confirmedBlock: number, epochSeconds: number) {
  const chests: Array<{ player: bigint; epoch: number; lords: number }> = [];
  for (let offset = 0; ; ) {
    const page = await fetchHeraldGameHistory(client.shard, client.gameId, {
      model: "StoryEvent",
      story: "SitePayout",
      limit: 500,
      offset,
    });
    if (page.complete_through_block === null || page.complete_through_block < confirmedBlock)
      throw new Error("Site history has not reached the final confirmed action");
    for (const event of page.items) {
      const payout = (event.value.story as Record<string, Record<string, unknown>>).SitePayout;
      if (Number(payout.category) !== StructureType.Ruin) continue;
      const reward = payout.reward as { resource_type: string; amount: string } | null;
      if (!reward || Number(reward.resource_type) !== ResourcesIds.Lords)
        throw new Error("A ruin cleared without its chest");
      chests.push({
        player: BigInt(String(event.value.owner)),
        epoch: Math.floor(Number(event.value.timestamp) / epochSeconds),
        lords: Number(BigInt(reward.amount) / precision),
      });
    }
    offset += page.items.length;
    if (offset >= page.total) return chests;
    if (page.items.length === 0) throw new Error("Site history ended before its declared total");
  }
}

/** Settles every bot before the workload, a few at a time; a founding that fails stops the run. */
async function settleFrontierPlayers(options: RunFrontierOptions, accounts: HarnessAccount[]): Promise<Player[]> {
  const players: Player[] = [];
  let next = 0;
  const settleNext = async (): Promise<void> => {
    for (let index = next++; index < accounts.length; index = next++) {
      const { transaction, player } = await settleFrontierPlayer(options, accounts[index]!, { stage: "setup" });
      options.setupTransactions.push(transaction);
      if (!player) throw new Error(transaction.error ?? "Frontier settlement failed");
      players[index] = player;
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.setupConcurrency, accounts.length) }, settleNext));
  return players;
}

async function settleFrontierPlayer(
  { game, provider, actorClients }: RunFrontierOptions,
  identity: HarnessAccount,
  timing: { stage: "setup" | "workload"; scheduledAtMs?: number },
): Promise<{ transaction: TrackedTransaction; player?: Player }> {
  const own = game.forActor(identity.address);
  const client = actorClients.get(actorKey(identity.address))?.client;
  if (!client) throw new Error(`Bot ${identity.botId} has no client of its own`);
  const transaction = await trackTransaction({
    botId: identity.botId,
    gameId: game.gameId,
    kind: "settle",
    provider,
    stage: timing.stage,
    scheduledAtMs: timing.scheduledAtMs,
    send: () =>
      own.submit(identity.account, () =>
        own.settle(identity.account, identity.owner, `Frontier${identity.botId}`, "frontier"),
      ),
  });
  if (transaction.outcome !== "completed") return { transaction };
  const realmId = await own.waitFor(
    () => own.settlementStructureIds(identity.address)?.[0],
    30_000,
    () => `Frontier settlement for bot ${identity.botId} in game ${game.gameId}`,
  );
  return {
    transaction,
    player: {
      identity,
      client,
      game: own,
      realmId,
      profile: identity.botId % 2 === 0 ? "check-in" : "daily",
      settledAt: now(),
      days: [],
      rungs: [],
      rollovers: [],
      captures: [],
      siteExchanges: new Map(),
      nextActionAt: 0,
    },
  };
}

const now = () => getBlockTimestamp().currentBlockTimestamp;
const currentDay = (player: Player) => player.days[player.days.length - 1]!;
function home(client: GameClient, player: Player): Home {
  return client.setup.store.require("Structure", { game_id: client.gameId, entity_id: player.realmId });
}
function activeArmies(client: GameClient, player: Player): Army[] {
  return liveHomeArmies(client.setup.store, player.realmId, client.gameId);
}
function calendarOf(client: GameClient) {
  const rules = readExpeditionRules(client.setup.store, client.gameId);
  if (!rules) throw new Error("A Frontier season has days");
  return rules;
}
/** The season day the chain clock is in; the workload only runs once the season has started. */
function today(client: GameClient) {
  const day = dayOf(calendarOf(client), now());
  if (!day) throw new Error("The Frontier season has not started");
  return day;
}
function observeDay(player: Player) {
  const { client, game } = player;
  const epoch = today(client).index;
  if (currentDay(player)?.epoch === epoch) return;
  const previous = currentDay(player);
  if (previous) {
    previous.endedAt = now();
    const rollover = {
      epoch,
      at: now(),
      realmId: player.realmId,
      previousArmies: previous.armyIds,
      currentArmies: [] as number[],
      labor: storedBalance(client, player, ResourcesIds.Labor).toString(),
      wheat: storedBalance(client, player, ResourcesIds.Wheat).toString(),
      essence: storedBalance(client, player, ResourcesIds.Essence).toString(),
      production: [...client.setup.store.inGame("ResourceProduction", game.gameId)]
        .filter((row) => row.entity_id === player.realmId)
        .map((row) => ({ resource: row.resource_type, rate: row.production_rate.toString() })),
    };
    player.rollovers.push(rollover);
    console.log(JSON.stringify({ frontierRollover: rollover, botId: player.identity.botId }));
  }
  player.days.push({
    epoch,
    startedAt: now(),
    actions: 0,
    explored: 0,
    sessionExplores: {},
    captures: 0,
    campCaptures: 0,
    campAttempts: [],
    exchanges: 0,
    attackStamina: 0,
    otherStamina: 0,
    armyIds: [],
    layout: "",
  });
  observeProgress(client, game, player);
}
/** A profile plays a few sessions spread over today, however long today lasts. */
function sessionPeriod(client: GameClient, player: Player): number {
  const day = today(client);
  return (day.end - day.start) / (player.profile === "check-in" ? 3 : 9);
}
function session(client: GameClient, player: Player): number {
  return Math.floor((now() - today(client).start) / sessionPeriod(client, player));
}
function inSession(client: GameClient, player: Player): boolean {
  const period = sessionPeriod(client, player);
  const intoDay = now() - today(client).start;
  return intoDay >= 2 && (now() - player.settledAt < period / 3 || intoDay % period < period / 3);
}
interface Action {
  kind: string;
  run(): Promise<unknown>;
  after?(): void;
  /** What the action takes from its realm's wheat, for the real-speed pass to check against the preset. */
  charge?: WheatCharge;
}

function command(client: GameClient, player: Player, value: NativeCommand): Action {
  return { kind: value.kind, run: () => client.setup.network.provider.submitCommand(player.identity.account, value) };
}

function chooseAction(client: GameClient, game: HarnessGame, player: Player): Action | undefined {
  return (
    planUpgrade(client, player) ??
    planMuster(client, player) ??
    planExpedition(client, game, player) ??
    planBuilding(client, player)
  );
}
function balance(client: GameClient, player: Player, resource: ResourcesIds): bigint {
  const manager = new ResourceManager(client.setup.store, player.realmId, client.gameId);
  const current = manager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, resource);
  if (current) return BigInt(current.balance);
  throw new Error(`Resource ${resource} for realm ${player.realmId} has an unknown balance projection`);
}

async function waitForRealmResources(client: GameClient, player: Player): Promise<void> {
  await waitForWorldState(
    client.setup.store,
    () => {
      const essence = new ResourceManager(client.setup.store, player.realmId, client.gameId).current(
        ResourcesIds.Essence,
      );
      return essence === undefined ? undefined : true;
    },
    30_000,
    () => resourceSnapshotState(client, player),
  );
}

function resourceSnapshotState(client: GameClient, player: Player): string {
  const store = client.setup.store;
  const scope = store.subscriptionScope();
  const resource = new ResourceManager(store, player.realmId, client.gameId);
  const inRealmScope = scope.known?.expedition?.realms.has(String(player.realmId));
  const balance = resource.current(ResourcesIds.Essence);
  return (
    `Frontier resource snapshot for realm ${player.realmId} in game ${client.gameId} ` +
    `(scope=${scope.known ? "known" : scope.unknown}, inRealmScope=${inRealmScope ?? "unknown"}, ` +
    `resourceOwner=${resource.hasResources()}, essence=${balance?.balance ?? "unknown"})`
  );
}

function storedBalance(client: GameClient, player: Player, resource: ResourcesIds): bigint {
  const result = new ResourceManager(client.setup.store, player.realmId, client.gameId).balance(resource);
  if (result !== undefined) return result;
  throw new Error(`Resource ${resource} for realm ${player.realmId} has an unknown balance`);
}
function planUpgrade(client: GameClient, player: Player): Action | undefined {
  const realm = home(client, player);
  const store = client.setup.store;
  const essence = balance(client, player, 38);
  const candidates: Array<{ cost: bigint; action: NativeCommand }> = [];
  const recipe = store.get("UpgradeRecipe", { game_id: client.gameId, level: realm.base.level + 1 });
  if (
    recipe &&
    recipe.costs.every((cost) => balance(client, player, cost.resource_type as ResourcesIds) >= cost.amount)
  )
    candidates.push({
      cost: recipe.costs.find((cost) => cost.resource_type === 38)?.amount ?? 0n,
      action: { kind: "LevelUp", value: player.realmId },
    });
  // Research the cheapest open row's next tier, always on its first side: Fields, Tools, Drill, camps.
  const learned = store.require("RealmKnowledge", { game_id: client.gameId, structure_id: player.realmId }).learned;
  const labor = balance(client, player, 23);
  for (let row = 0; row < research.ROW_COUNT; row++) {
    const category = researchRowCategory[row];
    if (category !== undefined && !standing(client, player, category)) continue;
    const price = store.get("ResearchPrice", { game_id: client.gameId, row, tier: researchTier(learned, row) + 1 });
    if (price && price.essence <= essence && price.labor <= labor)
      candidates.push({
        cost: price.essence,
        action: { kind: "Research", value: { structure_id: player.realmId, row, choice: 0 } },
      });
  }
  const selected = candidates.sort((a, b) => Number(a.cost - b.cost))[0];
  return selected ? command(client, player, selected.action) : undefined;
}
// Buildings of a type on the realm board, the castle's own workshop aside.
function standing(client: GameClient, player: Player, category: number): number {
  return [...client.setup.store.inGame("Building", client.gameId)].filter(
    (row) =>
      row.structure_id === player.realmId &&
      row.category === category &&
      (row.inner_col !== BUILDINGS_CENTER[0] || row.inner_row !== BUILDINGS_CENTER[1]),
  ).length;
}
function planBuilding(client: GameClient, player: Player): Action | undefined {
  const realm = home(client, player);
  const buildings = [...client.setup.store.inGame("Building", client.gameId)].filter(
    (row) =>
      row.structure_id === player.realmId &&
      (row.inner_col !== BUILDINGS_CENTER[0] || row.inner_row !== BUILDINGS_CENTER[1]),
  );
  const counts = (category: number) => buildings.filter((building) => building.category === category).length;
  const desired = [37, 1, 28, 25, 2, 37, 28, 25, 37, 2];
  const training = known(
    new ResourceManager(client.setup.store, player.realmId, client.gameId).balanceWithProduction(
      getBlockTimestamp().currentDefaultTick,
      ResourcesIds.Knight,
    ),
    player.realmId,
    "troop training balance",
  );
  let category = training.hasReachedMaxCapacity
    ? 2
    : desired.find(
        (category, index) =>
          counts(category) < desired.slice(0, index + 1).filter((entry) => entry === category).length,
      );
  if (category === undefined) return;
  const population = client.setup.store.require("StructureBuildings", {
    game_id: client.gameId,
    entity_id: player.realmId,
  }).population;
  const rule = client.setup.store.require("BuildingRule", { game_id: client.gameId, category });
  if (
    population.current + rule.population_cost >
    population.max +
      client.setup.store.require("SliceRules", { game_id: client.gameId }).building_config.base_population
  ) {
    category = 1;
  }
  const costs = getBuildingCosts(player.realmId, client.setup.store, category, true);
  if (!costs) throw new Error(`Missing building costs for ${category}`);
  if (costs.some((cost) => Number(balance(client, player, cost.resource)) < cost.amount * RESOURCE_PRECISION)) return;
  const tiles = client.views.buildingTiles(player.realmId);
  const spots = generateBuildablePositions(realm.base.level + 1).filter(
    (spot) => (spot.col !== BUILDINGS_CENTER[0] || spot.row !== BUILDINGS_CENTER[1]) && !tiles.isHexOccupied(spot),
  );
  if (!spots.length)
    return training.hasReachedMaxCapacity && counts(37) > 1
      ? planStorageDemolition(client, player, buildings)
      : undefined;
  const variation = player.identity.botId % spots.length;
  const spot = spots[player.profile === "daily" ? variation : spots.length - 1 - variation]!;
  return {
    kind: "build",
    run: () =>
      createGameActions(client, { signer: player.identity.account }).placeBuilding({
        structureId: player.realmId,
        buildingType: category,
        hex: spot,
        useSimpleCost: true,
      }),
  };
}
function planStorageDemolition(
  client: GameClient,
  player: Player,
  buildings: NativeRows["Building"][],
): Action | undefined {
  const surplusFarm = buildings.find((building) => building.category === 37);
  return surplusFarm
    ? command(client, player, {
        kind: "DestroyBuilding",
        value: {
          structure_id: player.realmId,
          coord: { alt: false, x: surplusFarm.inner_col, y: surplusFarm.inner_row },
        },
      })
    : undefined;
}
function planMuster(client: GameClient, player: Player): Action | undefined {
  const realm = home(client, player);
  const armies = activeArmies(client, player);
  const limits = client.setup.store.require("SliceRules", { game_id: client.gameId }).troop_limit_config;
  const slots = [limits.settlement_armies, limits.city_armies, limits.kingdom_armies, limits.empire_armies][
    realm.base.level
  ]!;
  if (armies.length >= slots) return;
  // One troop type: every army deploys Knight T1.
  const cap = BigInt(configManager.getMaxArmySize(realm.base.level, TroopTier.T1));
  const available = balance(client, player, ResourcesIds.Knight) / precision;
  let troops = available < cap ? (available * 9n) / 10n : cap;
  if (troops < 1000n) return;
  // Deploy only the troops whose recipe inputs the realm can pay for now.
  troops = affordableTroops(client, player, ResourcesIds.Knight, troops);
  if (troops < 1n) return;
  const cost = readTroopRaiseCost(
    client.setup.store,
    client.gameId,
    player.realmId,
    ResourcesIds.Knight,
    Number(troops),
    getBlockTimestamp().currentDefaultTick,
  );
  if (!canPayTroopRaise(cost)) return;
  const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
  const x = (realm.metadata.realm_id - 1) * spacing + spacing / 2;
  const y = currentDay(player).epoch * 4 * spacing + spacing / 2;
  const spawn = getNeighborHexes(x, y).find(
    (spot) => !getTileAt(client.setup.store, false, spot.col, spot.row, client.gameId)?.occupier_id,
  );
  if (!spawn) return;
  return {
    ...command(client, player, {
      kind: "CreateExplorer",
      value: {
        structure_id: player.realmId,
        category: 0,
        tier: 0,
        amount: troops * precision,
        direction: spawn.direction,
      },
    }),
    charge: { kind: "CreateExplorer", troopResource: ResourcesIds.Knight, troops },
  };
}
/** At most `troops`, and no more than every input of one troop's raise, held now, pays for. */
function affordableTroops(client: GameClient, player: Player, resource: ResourcesIds, troops: bigint): bigint {
  const perTroop = known(
    readTroopRaiseCost(
      client.setup.store,
      client.gameId,
      player.realmId,
      resource,
      1,
      getBlockTimestamp().currentDefaultTick,
    ),
    player.realmId,
    "troop raise cost",
  );
  return perTroop.reduce((fewest, { amount, held }) => {
    const paid = amount === 0n ? fewest : held / amount;
    return paid < fewest ? paid : fewest;
  }, troops);
}
function planExpedition(client: GameClient, game: HarnessGame, player: Player): Action | undefined {
  const rules = client.setup.store.require("SliceRules", { game_id: client.gameId });
  const day = currentDay(player);
  const stamina = rules.troop_stamina_config;
  for (const army of activeArmies(client, player)) {
    const amount = game.explorerStamina(army.explorer_id, game.currentTicks().armies);
    const upgrade = affordableUpgrade(client, army.explorer_id);
    if (upgrade)
      return command(client, player, {
        kind: "BuyTier",
        value: {
          explorer_id: army.explorer_id,
          attribute: { kind: upgrade, value: undefined },
          // A bot's Scouting raises rifts, the Essence it spends on research and depths.
          kind:
            upgrade === "Scouting"
              ? { kind: "Some", value: { kind: "Rift", value: undefined } }
              : { kind: "None", value: undefined },
        },
      });
    const coord = entityMapPosition(client.setup.store, client.gameId, army.explorer_id);
    const neighbors = getNeighborHexes(coord.x, coord.y);
    const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
    const realm = home(client, player);
    const depth = known(
      researchedDepth(client.setup.store, client.gameId, player.realmId),
      player.realmId,
      "researched depth",
    );
    const atEntrance =
      Math.floor(coord.y / spacing) % 4 === 0 &&
      neighbors.some(
        (spot) =>
          spot.col === (realm.metadata.realm_id - 1) * spacing + spacing / 2 &&
          spot.row === day.epoch * 4 * spacing + spacing / 2,
      );
    if (depth > 0 && atEntrance) {
      const cost = client.setup.store.require("DepthRules", { game_id: client.gameId, depth }).entry_stamina;
      if (amount < cost) continue;
      const enter = command(client, player, { kind: "EnterDepth", value: { explorer_id: army.explorer_id, depth } });
      enter.after = () => {
        day.otherStamina += cost;
      };
      return enter;
    }
    const target = neighbors
      .map((spot) => getTileAt(client.setup.store, false, spot.col, spot.row, client.gameId)?.occupier_id)
      .filter((id): id is number => Boolean(id))
      .map((id) => client.setup.store.get("Structure", { game_id: client.gameId, entity_id: id }))
      .find((site) => site && site.owner === 0n && GUARDED_SITES.has(site.base.category));
    if (target) {
      if (holdsForSite(amount, stamina.stamina_attack_req)) continue;
      let campAttempt = day.campAttempts.find(
        (attempt) => attempt.armyId === army.explorer_id && attempt.siteId === target.entity_id,
      );
      if (target.base.category === StructureType.Camp && !campAttempt) {
        campAttempt = { armyId: army.explorer_id, siteId: target.entity_id, lost: false };
        day.campAttempts.push(campAttempt);
      }
      const attack = command(client, player, {
        kind: "BattleGuard",
        value: { attacker_id: army.explorer_id, defender_id: target.entity_id },
      });
      attack.after = () => {
        day.exchanges++;
        const exchanges = (player.siteExchanges.get(target.entity_id) ?? 0) + 1;
        player.siteExchanges.set(target.entity_id, exchanges);
        const captured =
          client.setup.store.require("Structure", { game_id: client.gameId, entity_id: target.entity_id }).owner ===
          BigInt(player.identity.address);
        day.attackStamina += stamina.stamina_attack_req - (captured ? stamina.capture_stamina_refund : 0);
        if (captured) {
          day.captures++;
          if (target.base.category === StructureType.Camp) {
            day.campCaptures++;
            player.firstCampAt ??= now();
          }
          player.captures.push({
            epoch: day.epoch,
            siteId: target.entity_id,
            category: target.base.category,
            exchanges,
            at: now(),
          });
        } else if (
          !client.setup.store.get("ExplorerTroops", { game_id: client.gameId, explorer_id: army.explorer_id })?.troops
            .count
        ) {
          if (campAttempt) campAttempt.lost = true;
        }
      };
      return attack;
    }
    const limit = player.profile === "check-in" ? 6 : 5;
    const currentSession = session(client, player);
    if ((day.sessionExplores[currentSession] ?? 0) >= limit) continue;
    const frontier = neighbors
      .filter(
        (spot) =>
          spot.col % spacing >= spacing / 4 &&
          spot.col % spacing < (spacing * 3) / 4 &&
          spot.row % spacing >= spacing / 4 &&
          spot.row % spacing < (spacing * 3) / 4,
      )
      .find((spot) => !getTileAt(client.setup.store, false, spot.col, spot.row, client.gameId)?.biome);
    // The game's own checks, as the player's army panel makes them: stamina, and the food the realm pays per troop.
    const armyActions = new ArmyActionManager(client.setup.store, client.setup.systemCalls, army.explorer_id);
    const ticks = game.currentTicks();
    if (frontier && armyActions.canExplore(ticks.default, ticks.armies)) {
      const explore = {
        ...command(client, player, {
          kind: "Explore",
          value: { explorer_id: army.explorer_id, direction: frontier.direction },
        }),
        charge: { kind: "Explore" as const, troops: army.troops.count / precision },
      };
      explore.after = () => {
        day.explored++;
        day.sessionExplores[currentSession] = (day.sessionExplores[currentSession] ?? 0) + 1;
        day.otherStamina += stamina.stamina_explore_stamina_cost;
      };
      return explore;
    }
    if (!frontier && armyActions.maxTravelSteps(ticks.default, ticks.armies) >= 1) {
      const direction = pathToUnexplored(client, army);
      if (direction !== undefined) {
        const move = {
          ...command(client, player, {
            kind: "Move",
            value: { explorer_id: army.explorer_id, directions: [direction] },
          }),
          charge: { kind: "Move" as const, troops: army.troops.count / precision },
        };
        move.after = () => {
          day.otherStamina += stamina.stamina_travel_stamina_cost;
        };
        return move;
      }
    }
  }
}
/** An army beside a guard site waits to attack it: exploring on would walk it away from the capture it found. */
/** The army's lowest attribute it can afford to Upgrade, as a player spreading XP would; none while it cannot pay. */
function affordableUpgrade(client: GameClient, explorerId: number) {
  const progress = client.setup.store.require("ArmyProgress", { game_id: client.gameId, explorer_id: explorerId });
  const rules = client.setup.store.require("ArmyProgressionRules", { game_id: client.gameId });
  const prices = [rules.uncommon_xp, rules.rare_xp, rules.epic_xp, rules.legendary_xp];
  const tiers = [
    ["Battle", progress.battle],
    ["Logistics", progress.logistics],
    ["Scouting", progress.scouting],
    ["Homecoming", progress.homecoming],
  ] as const;
  const [attribute] =
    tiers
      .filter(([, tier]) => tier < prices.length + 1 && progress.xp >= prices[tier - 1]!)
      .toSorted((a, b) => a[1] - b[1])[0] ?? [];
  return attribute;
}

export function holdsForSite(stamina: number, attackRequirement: number): boolean {
  return stamina < attackRequirement;
}
function pathToUnexplored(client: GameClient, army: Army): number | undefined {
  const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
  const coord = entityMapPosition(client.setup.store, client.gameId, army.explorer_id);
  const queue = [{ x: coord.x, y: coord.y, direction: undefined as number | undefined }];
  const visited = new Set([`${coord.x},${coord.y}`]);
  for (const current of queue)
    for (const spot of getNeighborHexes(current.x, current.y)) {
      if (
        spot.col % spacing < spacing / 4 ||
        spot.col % spacing >= (spacing * 3) / 4 ||
        spot.row % spacing < spacing / 4 ||
        spot.row % spacing >= (spacing * 3) / 4
      )
        continue;
      const key = `${spot.col},${spot.row}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const tile = getTileAt(client.setup.store, false, spot.col, spot.row, client.gameId);
      if (!tile?.biome) return current.direction;
      if (!tile.occupier_id) queue.push({ x: spot.col, y: spot.row, direction: current.direction ?? spot.direction });
    }
}
function observeProgress(client: GameClient, game: HarnessGame, player: Player) {
  const realm = home(client, player);
  for (const [lane, level] of [
    ["castle", realm.base.level],
    [
      "barracks",
      researchTier(
        known(realmLearned(client.setup.store, client.gameId, player.realmId), player.realmId, "realm knowledge"),
        research.ROW_BARRACKS,
      ),
    ],
    [
      "depth",
      known(researchedDepth(client.setup.store, client.gameId, player.realmId), player.realmId, "researched depth"),
    ],
  ] as const) {
    if (level > 0 && !player.rungs.some((rung) => rung.lane === lane && rung.level === level))
      player.rungs.push({ lane, level, at: now() });
  }
  const day = currentDay(player);
  day.armyIds = [...new Set([...day.armyIds, ...activeArmies(client, player).map((army) => army.explorer_id)])];
  day.layout = [...client.setup.store.inGame("Building", game.gameId)]
    .filter((row) => row.structure_id === player.realmId)
    .map((row) => `${row.inner_col},${row.inner_row}:${row.category}`)
    .sort()
    .join(";");
  const rollover = player.rollovers[player.rollovers.length - 1];
  if (rollover?.epoch === day.epoch) rollover.currentArmies = day.armyIds;
}

/** Section 08 measures from observed player histories; absent milestones stay absent. */
export function summarizeFrontierDesign(evidence: FrontierEvidence) {
  return (["check-in", "daily"] as const).map((profile) => {
    const players = evidence.players.filter((player) => player.profile === profile);
    const observedDays = players.map(
      (player) => ((player.days.at(-1)?.endedAt ?? player.settledAt) - player.settledAt) / evidence.meanDaySeconds,
    );
    const playerDays = observedDays.reduce((sum, days) => sum + days, 0);
    const days = players.flatMap((player) => player.days);
    const camps = days.flatMap((day) => day.campAttempts);
    const attackStamina = days.reduce((sum, day) => sum + day.attackStamina, 0);
    const otherStamina = days.reduce((sum, day) => sum + day.otherStamina, 0);
    const chests = players.flatMap((player) => player.chests);
    return {
      profile,
      players: players.length,
      observedDays,
      firstCamp: {
        target: "< 120 seconds",
        acceleratedSeconds: players.map((player) =>
          player.firstCampAt === undefined ? null : player.firstCampAt - player.settledAt,
        ),
        note: "Accelerated bot session, not a browser booth acceptance pass",
      },
      weekOneRungs: {
        target: 4,
        values: players.map((player, index) =>
          observedDays[index] >= 7
            ? player.rungs.filter((rung) => rung.at - player.settledAt <= 7 * evidence.meanDaySeconds).length
            : null,
        ),
      },
      depthOneDays: {
        target: profile === "check-in" ? "20–28 days" : null,
        values: players.map((player) => {
          const rung = player.rungs.find((rung) => rung.lane === "depth" && rung.level === 1);
          return rung ? (rung.at - player.settledAt) / evidence.meanDaySeconds : null;
        }),
        note: "Null means not reached within observedDays, not an estimated completion date",
      },
      rungIntervalsDays: {
        target: "5–9 days",
        values: players.flatMap((player) =>
          player.rungs.slice(1).map((rung, index) => (rung.at - player.rungs[index].at) / evidence.meanDaySeconds),
        ),
      },
      actionsPerPlayerDay: {
        target: "30–60",
        value: playerDays ? days.reduce((sum, day) => sum + day.actions, 0) / playerDays : null,
      },
      campsLost: {
        target: "10–25%",
        attempted: camps.length,
        lost: camps.filter((camp) => camp.lost).length,
        percent: camps.length ? (camps.filter((camp) => camp.lost).length * 100) / camps.length : null,
      },
      attackingStamina: {
        target: "25–45%",
        percent: attackStamina + otherStamina ? (attackStamina * 100) / (attackStamina + otherStamina) : null,
        note: "Configured action costs minus capture refunds; excludes relic modifiers",
      },
      distinctLayouts: {
        target: "> 5 among the top 100",
        value: new Set(players.map((player) => player.days.at(-1)?.layout)).size,
        sampledRealms: players.length,
      },
      chestsPerPlayerWeek: {
        target: "5–13",
        opened: chests.length,
        value: playerDays ? (chests.length * 7) / playerDays : null,
      },
      ruinChestLords: {
        target: "at most the day price ceiling per share",
        paid: chests.reduce((sum, chest) => sum + chest.lords, 0),
        note: "Paid into the realm at each ruin's clear; withdrawal is not exercised",
      },
    };
  });
}
