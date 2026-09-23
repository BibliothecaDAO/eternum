import { setTimeout as sleep } from "node:timers/promises";
import { Account } from "starknet";
import { fetchHeraldGameHistory } from "@bibliothecadao/eternum/game-client";
import {
  createGameActions,
  configManager,
  getBuildingCosts,
  getBlockTimestamp,
  getTileAt,
  ResourceManager,
  type GameClient,
} from "@bibliothecadao/eternum";
import { generateBuildablePositions } from "@bibliothecadao/eternum/automation";
import {
  BUILDINGS_CENTER,
  getNeighborHexes,
  RESOURCE_PRECISION,
  TroopTier,
  type ResourcesIds,
} from "@bibliothecadao/types";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import type { NativeRows } from "../../../contracts/l3/world-native/schema/client.gen";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import {
  buildNativeGameParams,
  buildNativePresetRegistration,
  loadNativePresetConfiguration,
  registerNativePreset,
} from "../../../config/deployer/clean/registrar/native-preset";
import type { HarnessAccount } from "./account-factory";
import { createRpcMetrics, trackTransaction, type TrackedTransaction, type WorkloadResult } from "./driver";
import type { HarnessGame } from "./harness-game";
import type { HarnessProvider } from "./provider";

const EPOCH_SECONDS = 720;
const TIME_SCALE = 86400 / EPOCH_SECONDS;
const precision = BigInt(RESOURCE_PRECISION);

/** The existing preset and registrar path, with only clocks accelerated for the design run. */
export async function launchFrontierSeason(provider: HarnessProvider, gameName: string, minutes: number) {
  const manifest = process.env.NATIVE_WORLD_MANIFEST;
  const address = process.env.DEPLOYER_ACCOUNT_ADDRESS;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!manifest || !address || !privateKey)
    throw new Error("Frontier launch requires the isolated manifest and authority");
  const account = new Account({ provider, address, signer: privateKey });
  const config = loadNativePresetConfiguration("madara.frontier", 1);
  const canonical = buildNativePreset(config, 1);
  const accelerated = buildNativePreset(config, 1);
  accelerateSeasonClocks(accelerated);
  const canonicalRegistration = buildNativePresetRegistration(canonical, 1, manifest);
  const acceleratedRegistration = buildNativePresetRegistration(accelerated, 1, manifest);
  const startAt = Math.floor(Date.now() / 1000) + 60;
  const params = buildNativeGameParams(config, {
    gameName,
    presetId: 1,
    startMainAt: startAt,
    chainTimestamp: startAt - 60,
    durationSeconds: Math.ceil(minutes * 60) + EPOCH_SECONDS,
    devModeOn: false,
    singleRealmMode: true,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  try {
    const registered = await registerNativePreset(account, 1, acceleratedRegistration);
    const created = await createRegistrarGame(account, params, "madara.frontier", accelerated);
    if (!created.gameId) throw new Error("Frontier registrar did not emit a game id");
    console.log(
      JSON.stringify({
        frontierSeason: created.gameId,
        epochSeconds: EPOCH_SECONDS,
        timeScale: TIME_SCALE,
        presetCommitment: acceleratedRegistration.commitment,
        registerTransaction: registered,
        createTransaction: created.transactionHash,
      }),
    );
    return { gameId: created.gameId, gameName, startAt };
  } finally {
    const restored = await registerNativePreset(account, 1, canonicalRegistration);
    console.log(
      JSON.stringify({ restoredPreset: 1, commitment: canonicalRegistration.commitment, transaction: restored }),
    );
  }
}

function accelerateSeasonClocks(accelerated: ReturnType<typeof buildNativePreset>): void {
  accelerated.rules.epoch_seconds = EPOCH_SECONDS;
  accelerated.rules.tick_config.armies_tick_in_seconds /= TIME_SCALE;
  for (const resource of accelerated.resources.resources) {
    resource.realm_rate *= BigInt(TIME_SCALE);
    resource.village_rate *= BigInt(TIME_SCALE);
  }
  const board = accelerated.structures.board.unwrap();
  if (!board || typeof board !== "object" || !("workshop_rate" in board) || typeof board.workshop_rate !== "bigint")
    throw new Error("Frontier preset requires a workshop rate");
  board.workshop_rate *= BigInt(TIME_SCALE);
  for (const depth of accelerated.settlement.depths) depth.mine_rate *= BigInt(TIME_SCALE);
  for (const mine of accelerated.resources.mine_kinds) mine.config.production_rate *= BigInt(TIME_SCALE);
}

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
export interface FrontierEvidence {
  epochSeconds: number;
  timeScale: number;
  tokenCap: number;
  players: Array<
    Omit<Player, "identity" | "siteExchanges" | "nextActionAt"> & {
      botId: number;
      owner: string;
      chests: Array<{ epoch: number; depth: number; kind: string; quality: number }>;
    }
  >;
}
interface RunFrontierOptions {
  onReady?: () => Promise<void>;
  client: GameClient;
  game: HarnessGame;
  provider: HarnessProvider;
  accounts: HarnessAccount[];
  minutes: number;
  setupTransactions: TrackedTransaction[];
}

/** Decisions use the same synchronized native facts and command submission as a player. */
export async function runFrontierWorkload(options: RunFrontierOptions): Promise<WorkloadResult> {
  const { client, game, accounts, provider } = options;
  const rules = client.setup.store.require("SliceRules", { game_id: game.gameId });
  if (rules.epoch_seconds !== EPOCH_SECONDS) throw new Error("Frontier design run requires its accelerated season");
  await game.waitUntilPlaying();
  const players: Player[] = [];
  for (const identity of accounts) players.push(await settleFrontierPlayer(options, identity));
  for (const player of players) observeDay(client, game, player);
  await options.onReady?.();
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + options.minutes * 60000;
  const actions: TrackedTransaction[] = [];
  let ticks = 0;
  let failed = false;
  while (Date.now() < deadline && !failed) {
    await Promise.all(
      players.map(async (player) => {
        observeDay(client, game, player);
        if (now() < player.nextActionAt || !inSession(player)) return;
        const action = chooseAction(client, game, player);
        if (!action) return;
        const result = await trackTransaction({
          botId: player.identity.botId,
          gameId: game.gameId,
          kind: action.kind,
          provider,
          stage: "workload",
          tick: currentDay(player).epoch,
          send: () => game.submit(player.identity.account, action.run),
        });
        actions.push(result);
        player.nextActionAt = now() + 1;
        if (result.outcome !== "completed") {
          console.error(JSON.stringify({ frontierFailure: result }));
          failed = true;
          return;
        }
        currentDay(player).actions++;
        action.after?.();
        observeProgress(client, game, player);
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
  const chests = await readChestHistory(client, Math.max(0, ...actions.map((action) => action.acceptedOnL2Block ?? 0)));
  const evidence: FrontierEvidence = {
    epochSeconds: EPOCH_SECONDS,
    timeScale: TIME_SCALE,
    tokenCap: client.setup.store.require("ChestRules", { game_id: game.gameId }).token_cap,
    players: players.map(({ identity, siteExchanges: _exchanges, nextActionAt: _next, ...player }) => ({
      ...player,
      botId: identity.botId,
      owner: identity.owner,
      chests: chests
        .filter((row) => row.player === BigInt(identity.address))
        .map((row) => ({ epoch: Number(row.epoch), depth: row.depth, kind: row.kind, quality: row.quality })),
    })),
  };
  return {
    profile: "frontier",
    frontier: evidence,
    actions,
    plannedActions: actions.length,
    overheadRpc: createRpcMetrics(),
    startedAt,
    endedAt: new Date().toISOString(),
    ticks,
    readinessWaitMs: 0,
  };
}

async function readChestHistory(client: GameClient, confirmedBlock: number) {
  const rewards: Array<{ player: bigint; epoch: number; depth: number; kind: string; quality: number }> = [];
  for (let offset = 0; ; ) {
    const page = await fetchHeraldGameHistory(client.shard, client.gameId, {
      model: "StoryEvent",
      story: "ChestReward",
      limit: 500,
      offset,
    });
    if (page.complete_through_block === null || page.complete_through_block < confirmedBlock)
      throw new Error("Chest history has not reached the final confirmed action");
    for (const event of page.items) {
      const row = (event.value.story as Record<string, Record<string, string>>).ChestReward;
      const reward = {
        player: BigInt(row.player),
        epoch: Number(row.epoch),
        depth: Number(row.depth),
        kind: row.kind,
        quality: Number(row.quality),
      };
      if (
        ![reward.epoch, reward.depth, reward.quality].every(Number.isSafeInteger) ||
        !["Relic", "Cosmetic", "Token"].includes(reward.kind)
      )
        throw new Error("Malformed chest reward history");
      rewards.push(reward);
    }
    offset += page.items.length;
    if (offset >= page.total) return rewards;
    if (page.items.length === 0) throw new Error("Chest history ended before its declared total");
  }
}

async function settleFrontierPlayer(
  { game, provider, setupTransactions }: RunFrontierOptions,
  identity: HarnessAccount,
): Promise<Player> {
  const settled = await trackTransaction({
    botId: identity.botId,
    gameId: game.gameId,
    kind: "settle",
    provider,
    stage: "setup",
    send: () =>
      game.submit(identity.account, () =>
        game.settle(identity.account, identity.owner, `Frontier${identity.botId}`, "frontier"),
      ),
  });
  setupTransactions.push(settled);
  if (settled.outcome !== "completed") throw new Error(settled.error ?? "Frontier settlement failed");
  const realmId = game.settlementStructureIds(identity.address)?.[0];
  if (realmId === undefined) throw new Error("Settlement did not publish the home realm");
  return {
    identity,
    realmId,
    profile: identity.botId % 2 === 0 ? "check-in" : "daily",
    settledAt: now(),
    days: [],
    rungs: [],
    rollovers: [],
    captures: [],
    siteExchanges: new Map(),
    nextActionAt: 0,
  };
}

const now = () => getBlockTimestamp().currentBlockTimestamp;
const currentDay = (player: Player) => player.days[player.days.length - 1]!;
function home(client: GameClient, player: Player): Home {
  return client.setup.store.require("Structure", { game_id: client.gameId, entity_id: player.realmId });
}
function activeArmies(client: GameClient, player: Player): Army[] {
  const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
  return [...client.setup.store.inGame("ExplorerTroops", client.gameId)].filter(
    (army) =>
      army.owner === player.realmId &&
      army.troops.count > 0n &&
      Math.floor(army.coord.y / spacing / 4) === currentDay(player).epoch,
  );
}
function currentEpoch(client: GameClient): number {
  const registry = client.setup.store.require("GameRegistry", { game_id: client.gameId });
  return Math.floor(now() / EPOCH_SECONDS) - Math.floor(Number(registry.start_main_at) / EPOCH_SECONDS);
}
function observeDay(client: GameClient, game: HarnessGame, player: Player) {
  const epoch = currentEpoch(client);
  if (currentDay(player)?.epoch === epoch) return;
  const previous = currentDay(player);
  if (previous) {
    previous.endedAt = now();
    const resources = new ResourceManager(client.setup.store, player.realmId, game.gameId);
    const rollover = {
      epoch,
      at: now(),
      realmId: player.realmId,
      previousArmies: previous.armyIds,
      currentArmies: [] as number[],
      labor: resources.balance(23).toString(),
      wheat: resources.balance(35).toString(),
      essence: resources.balance(38).toString(),
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
function session(player: Player): number {
  return Math.floor((now() % EPOCH_SECONDS) / (EPOCH_SECONDS / (player.profile === "check-in" ? 3 : 9)));
}
function inSession(player: Player): boolean {
  const period = EPOCH_SECONDS / (player.profile === "check-in" ? 3 : 9);
  return now() % EPOCH_SECONDS >= 2 && (now() - player.settledAt < period / 3 || now() % period < period / 3);
}
interface Action {
  kind: string;
  run(): Promise<unknown>;
  after?(): void;
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
  return BigInt(
    new ResourceManager(client.setup.store, player.realmId, client.gameId).balanceWithProduction(
      getBlockTimestamp().currentDefaultTick,
      resource,
    ).balance,
  );
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
  const board = store.require("BoardRules", { game_id: client.gameId });
  if (realm.metadata.barracks_tier < 2)
    candidates.push({
      cost: realm.metadata.barracks_tier === 0 ? board.barracks_ii_cost : board.barracks_iii_cost,
      action: {
        kind: "BuyRealmUpgrade",
        value: { structure_id: player.realmId, lane: { kind: "Barracks", value: undefined } },
      },
    });
  if (realm.metadata.attunement < 3)
    candidates.push({
      cost: store.require("DepthRules", { game_id: client.gameId, depth: realm.metadata.attunement + 1 })
        .attunement_cost,
      action: {
        kind: "BuyRealmUpgrade",
        value: { structure_id: player.realmId, lane: { kind: "Attunement", value: undefined } },
      },
    });
  const selected = candidates
    .filter((candidate) => candidate.cost <= essence)
    .sort((a, b) => Number(a.cost - b.cost))[0];
  return selected ? command(client, player, selected.action) : undefined;
}
function planBuilding(client: GameClient, player: Player): Action | undefined {
  const realm = home(client, player);
  const buildings = [...client.setup.store.inGame("Building", client.gameId)].filter(
    (row) =>
      row.outer_entity_id === player.realmId &&
      (row.inner_col !== BUILDINGS_CENTER[0] || row.inner_row !== BUILDINGS_CENTER[1]),
  );
  const counts = (category: number) => buildings.filter((building) => building.category === category).length;
  const desired = [37, 1, 28, 25, 2, 37, 28, 25, 37, 2];
  const training = new ResourceManager(client.setup.store, player.realmId, client.gameId).balanceWithProduction(
    getBlockTimestamp().currentDefaultTick,
    (26 + realm.metadata.barracks_tier) as ResourcesIds,
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
  const storageBonuses = client.setup.store
    .require("BoardRules", { game_id: client.gameId })
    .neighbors.filter((bonus) => bonus.neighbor === 37 && bonus.capacity_bps > 0)
    .map((bonus) => bonus.building);
  const surplusFarm = buildings.find(
    (building) =>
      building.category === 37 &&
      !getNeighborHexes(building.inner_col, building.inner_row).some((spot) =>
        buildings.some(
          (neighbor) =>
            neighbor.inner_col === spot.col &&
            neighbor.inner_row === spot.row &&
            storageBonuses.includes(neighbor.category),
        ),
      ),
  );
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
  let tier = realm.metadata.barracks_tier;
  let troops = 0n;
  for (; tier >= 0; tier--) {
    const resource = (26 + tier) as ResourcesIds;
    const cap = BigInt(
      configManager.getMaxArmySize(realm.base.level, [TroopTier.T1, TroopTier.T2, TroopTier.T3][tier]!),
    );
    const available = balance(client, player, resource) / precision;
    troops = available < cap ? (available * 9n) / 10n : cap;
    if (troops >= 1000n) break;
  }
  if (tier < 0) return;
  const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
  const x = (realm.metadata.realm_id - 1) * spacing + spacing / 2;
  const y = currentDay(player).epoch * 4 * spacing + spacing / 2;
  const spawn = getNeighborHexes(x, y).find(
    (spot) => !getTileAt(client.setup.store, false, spot.col, spot.row, client.gameId)?.occupier_id,
  );
  if (!spawn) return;
  return command(client, player, {
    kind: "CreateExplorer",
    value: { structure_id: player.realmId, category: 0, tier, amount: troops * precision, direction: spawn.direction },
  });
}
function planExpedition(client: GameClient, game: HarnessGame, player: Player): Action | undefined {
  const rules = client.setup.store.require("SliceRules", { game_id: client.gameId });
  const day = currentDay(player);
  const stamina = rules.troop_stamina_config;
  for (const army of activeArmies(client, player)) {
    const amount = game.explorerStamina(army.explorer_id, game.currentTicks().armies);
    if (army.troops.battle_cooldown_end > game.currentTicks().armies) continue;
    const relic = [...client.setup.store.inGame("ResourceBalance", client.gameId)].find(
      (row) =>
        row.entity_id === army.explorer_id && row.resource_type >= 39 && row.resource_type <= 56 && row.balance > 0n,
    );
    if (relic)
      return command(client, player, {
        kind: "ApplyRelic",
        value: {
          entity_id: army.explorer_id,
          relic_id: relic.resource_type,
          recipient: { kind: "Explorer", value: undefined },
        },
      });
    const neighbors = getNeighborHexes(army.coord.x, army.coord.y);
    const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
    const realm = home(client, player);
    const depth = realm.metadata.attunement;
    const atEntrance =
      Math.floor(army.coord.y / spacing) % 4 === 0 &&
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
      .find((site) => site && site.owner === 0n && (site.base.category === 4 || site.base.category === 7));
    if (target && amount >= stamina.stamina_attack_req) {
      let campAttempt = day.campAttempts.find(
        (attempt) => attempt.armyId === army.explorer_id && attempt.siteId === target.entity_id,
      );
      if (target.base.category === 7 && !campAttempt) {
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
          if (target.base.category === 7) {
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
    const currentSession = session(player);
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
    if (frontier && amount >= stamina.stamina_explore_stamina_cost) {
      const explore = command(client, player, {
        kind: "Explore",
        value: { explorer_id: army.explorer_id, direction: frontier.direction },
      });
      explore.after = () => {
        day.explored++;
        day.sessionExplores[currentSession] = (day.sessionExplores[currentSession] ?? 0) + 1;
        day.otherStamina += stamina.stamina_explore_stamina_cost;
      };
      return explore;
    }
    if (!frontier && amount >= stamina.stamina_travel_stamina_cost) {
      const direction = pathToUnexplored(client, army);
      if (direction !== undefined) {
        const move = command(client, player, {
          kind: "Move",
          value: { explorer_id: army.explorer_id, directions: [direction] },
        });
        move.after = () => {
          day.otherStamina += stamina.stamina_travel_stamina_cost;
        };
        return move;
      }
    }
  }
}
function pathToUnexplored(client: GameClient, army: Army): number | undefined {
  const spacing = client.setup.store.require("SettlementRules", { game_id: client.gameId }).spacing;
  const queue = [{ x: army.coord.x, y: army.coord.y, direction: undefined as number | undefined }];
  const visited = new Set([`${army.coord.x},${army.coord.y}`]);
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
    ["barracks", realm.metadata.barracks_tier],
    ["attunement", realm.metadata.attunement],
  ] as const) {
    if (level > 0 && !player.rungs.some((rung) => rung.lane === lane && rung.level === level))
      player.rungs.push({ lane, level, at: now() });
  }
  const day = currentDay(player);
  day.armyIds = [...new Set([...day.armyIds, ...activeArmies(client, player).map((army) => army.explorer_id)])];
  day.layout = [...client.setup.store.inGame("Building", game.gameId)]
    .filter((row) => row.outer_entity_id === player.realmId)
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
      (player) => ((player.days.at(-1)?.endedAt ?? player.settledAt) - player.settledAt) / evidence.epochSeconds,
    );
    const playerDays = observedDays.reduce((sum, days) => sum + days, 0);
    const days = players.flatMap((player) => player.days);
    const camps = days.flatMap((day) => day.campAttempts);
    const attackStamina = days.reduce((sum, day) => sum + day.attackStamina, 0);
    const otherStamina = days.reduce((sum, day) => sum + day.otherStamina, 0);
    const chests = players.flatMap((player) => player.chests);
    const deepDays = players.reduce(
      (total, player) =>
        total +
        player.days.filter((day) =>
          player.chests.some(
            (chest) => chest.epoch === Math.floor(day.startedAt / evidence.epochSeconds) && chest.depth === 3,
          ),
        ).length,
      0,
    );
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
            ? player.rungs.filter((rung) => rung.at - player.settledAt <= 7 * evidence.epochSeconds).length
            : null,
        ),
      },
      attunementOneDays: {
        target: profile === "check-in" ? "20–28 days" : null,
        values: players.map((player) => {
          const rung = player.rungs.find((rung) => rung.lane === "attunement" && rung.level === 1);
          return rung ? (rung.at - player.settledAt) / evidence.epochSeconds : null;
        }),
        note: "Null means not reached within observedDays, not an estimated completion date",
      },
      rungIntervalsDays: {
        target: "5–9 days",
        values: players.flatMap((player) =>
          player.rungs.slice(1).map((rung, index) => (rung.at - player.rungs[index].at) / evidence.epochSeconds),
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
      deepestEpics: {
        target: "~1 per week",
        opened: chests.filter((chest) => chest.depth === 3 && chest.quality === 3).length,
        daysWithDeepChests: deepDays,
        note: "No weekly estimate without a week of deepest-ground exposure",
      },
      tokenResults: {
        target: "preset daily cap; value set by budget",
        recorded: chests.filter((chest) => chest.kind === "Token").length,
        note: "Claims recorded only; no token fulfilment",
      },
    };
  });
}
