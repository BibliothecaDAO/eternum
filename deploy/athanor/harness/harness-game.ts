import { requireNativeExecutionOutcome } from "@bibliothecadao/provider";
import { setTimeout as sleep } from "node:timers/promises";
import { actorKey, type HarnessGameClient, type HeraldConfirmations } from "./game-client";
import {
  buildArmyPathIndexes,
  configManager,
  createGameActions,
  FELT_CENTER,
  getBlockTimestamp,
  getTileAt,
  ResourceManager,
  StaminaManager,
  multiplyByPrecision,
  type ArmyPathIndexes,
  type GameActions,
  type GameClient,
  waitForWorldState,
} from "@bibliothecadao/eternum";
import { shortString, type Account } from "starknet";
import { ResourcesIds, StructureType, TroopType, type ID, type NativeTicketIdentity } from "@bibliothecadao/types";

export interface Coord {
  x: number;
  y: number;
}

export interface ChainTicks {
  armies: number;
  default: number;
}

export interface ExplorerRow {
  coord: Coord;
  staminaAmount: bigint;
  staminaUpdatedTick: bigint;
}

export interface ProductionState {
  laborBalance: bigint;
  woodOutput: bigint;
}

/** A transaction the chain accepted into its mempool; `confirmed` is the client's own wait on Herald's stream. */
export interface HarnessSubmission {
  transactionHash: string;
  confirmed?: Promise<unknown>;
  /** When Herald reported the transaction confirmed, in driver-clock milliseconds. */
  heraldConfirmedAtMs?: Promise<number>;
}

interface SubmittedEvent {
  ticket?: NativeTicketIdentity;
  signerAddress?: string;
  transactionHash: string;
}

/** The game as the harness plays it: native facts, the projection's occupancy, and per-bot action facades. */
export interface HarnessGame {
  gameId: number;
  /** The game as this bot's own client sees and acts on it. */
  forActor(address: string): HarnessGame;
  waitUntilPlaying(): Promise<void>;
  /** Actions signed by this bot; every bot gets its own facade over the shared world. */
  actionsFor(signer: Account): GameActions;
  currentTicks(): ChainTicks;
  mapCenter(): Coord;
  settlementStructureIds(player: string): ID[] | undefined;
  structureCoord(structureId: ID): Coord | undefined;
  /** The T1 troop type the structure holds enough of to field one harness explorer. */
  startingTroopType(structureId: ID): TroopType | undefined;
  explorersOf(structureId: ID): ID[];
  explorer(explorerId: ID): ExplorerRow | undefined;
  explorerStamina(explorerId: ID, armiesTick: number): number;
  explorerMaxStamina(explorerId: ID): number;
  /** The cheapest stamina an action of this kind can cost under the game's rulebook. */
  minimumStaminaFor(kind: "move" | "explore"): number;
  production(structureId: ID): ProductionState | undefined;
  armyPathIndexes(): ArmyPathIndexes;
  /** The block the bot's facts were confirmed through, or null before Herald names one. */
  factHeadBlock(): number | null;
  /** A surface hex as the bot's facts show it. */
  tileView(coord: Coord): TileView;
  settle(signer: Account, owner: string, name: string, gameType: "blitz" | "eternum" | "frontier"): Promise<unknown>;
  produceWood(signer: Account, structureId: ID): Promise<unknown>;
  /** Runs a client action and resolves with its hash as soon as the chain accepted it; one at a time per signer. */
  submit(signer: Account, act: () => Promise<unknown>): Promise<HarnessSubmission>;
  /** Resolves once `read` returns a value; re-read after every applied sync slice. */
  waitFor<T>(read: () => T | undefined, timeoutMs: number, describe: () => string): Promise<T>;
}

export interface TileView {
  explored: boolean;
  occupierId: number;
}

export const EXPLORER_TROOP_COUNT = 10;
const T1_TROOP_TYPES: readonly TroopType[] = [TroopType.Knight, TroopType.Paladin, TroopType.Crossbowman];

/**
 * Without actor clients, the game one client sees and acts on, as one bot. With them, reads come from `client` and
 * everything a signer does (its calls, nonce, submission and outcome) goes through that signer's own client.
 */
export function createHarnessGame(
  client: GameClient,
  heraldConfirmations?: HeraldConfirmations,
  actorClients?: ReadonlyMap<string, HarnessGameClient>,
): HarnessGame {
  const game = createClientGame(client, heraldConfirmations);
  if (!actorClients) return game;
  const actorGames = new Map<string, HarnessGame>();
  const forActor = (address: string): HarnessGame => {
    const key = actorKey(address);
    const known = actorGames.get(key);
    if (known) return known;
    const own = actorClients.get(key);
    if (!own) throw new Error(`Bot ${address} has no client of its own`);
    const actorGame = createClientGame(own.client, own.heraldConfirmations);
    actorGames.set(key, actorGame);
    return actorGame;
  };
  return {
    ...game,
    forActor,
    actionsFor: (signer) => forActor(signer.address).actionsFor(signer),
    settle: (signer, owner, name, gameType) => forActor(signer.address).settle(signer, owner, name, gameType),
    produceWood: (signer, structureId) => forActor(signer.address).produceWood(signer, structureId),
    submit: (signer, act) => forActor(signer.address).submit(signer, act),
  };
}

function createClientGame(client: GameClient, heraldConfirmations?: HeraldConfirmations): HarnessGame {
  const { store, systemCalls } = client.setup;
  const game_id = client.gameId;
  const awaitingHash = new Set<string>();

  const game: HarnessGame = {
    gameId: client.gameId,
    forActor: () => game,
    waitUntilPlaying: () => waitUntilPlaying(client),
    actionsFor: (signer) => createGameActions(client, { signer }),
    currentTicks: () => {
      const timestamp = getBlockTimestamp();
      return { armies: timestamp.currentArmiesTick, default: timestamp.currentDefaultTick };
    },
    mapCenter: () => ({ x: FELT_CENTER(), y: FELT_CENTER() }),
    settlementStructureIds: (player) => {
      if (![...store.inGame("PlayerEntry", game_id)].some((row) => row.player === BigInt(player))) return undefined;
      return [...store.structuresOwnedBy(game_id, BigInt(player))]
        .filter((row) => row.base.category === StructureType.Realm)
        .map((row) => row.entity_id);
    },
    structureCoord: (structureId) => {
      const structure = store.get("Structure", { game_id, entity_id: structureId });
      return structure ? { x: structure.base.coord_x, y: structure.base.coord_y } : undefined;
    },
    startingTroopType: (structureId) => {
      const resource = new ResourceManager(store, structureId);
      const required = BigInt(multiplyByPrecision(EXPLORER_TROOP_COUNT));
      const balances = [ResourcesIds.Knight, ResourcesIds.Paladin, ResourcesIds.Crossbowman].map((id) =>
        resource.balance(id),
      );
      const funded = balances.findIndex((balance) => BigInt(balance) >= required);
      if (funded < 0) return undefined;
      return T1_TROOP_TYPES[funded];
    },
    explorersOf: (structureId) => client.views.explorers(structureId).map((explorer) => explorer.entityId),
    explorer: (explorerId) => {
      const row = store.get("ExplorerTroops", { game_id, explorer_id: explorerId });
      if (!row) return undefined;
      return {
        coord: { x: row.coord.x, y: row.coord.y },
        staminaAmount: BigInt(row.troops.stamina.amount),
        staminaUpdatedTick: BigInt(row.troops.stamina.updated_tick),
      };
    },
    explorerStamina: (explorerId, armiesTick) => {
      const stamina = client.views.stamina(explorerId).getStamina(armiesTick);
      if (!stamina) throw new Error(`Explorer ${explorerId} has no synchronized stamina`);
      return Number(stamina.amount);
    },
    explorerMaxStamina: (explorerId) => {
      const { troops } = store.require("ExplorerTroops", { game_id, explorer_id: explorerId });
      return StaminaManager.getMaxStamina(troops.category, troops.tier);
    },
    minimumStaminaFor: (kind) =>
      kind === "explore" ? configManager.getExploreStaminaCost() : configManager.getMinTravelStaminaCost(),
    production: (structureId) => {
      const resource = new ResourceManager(store, structureId);
      return {
        laborBalance: resource.balance(ResourcesIds.Labor),
        woodOutput: resource.current(ResourcesIds.Wood)?.production?.output_amount_left ?? 0n,
      };
    },
    armyPathIndexes: () => buildArmyPathIndexes(client),
    factHeadBlock: () => heraldConfirmations?.confirmedBlock() ?? null,
    tileView: ({ x, y }) => {
      const tile = getTileAt(store, false, x, y, game_id);
      return { explored: Boolean(tile?.biome), occupierId: Number(tile?.occupier_id ?? 0) };
    },
    settle: (signer, _owner, name) => systemCalls.settle_season({ signer, name: shortString.encodeShortString(name) }),
    produceWood: (signer, structureId) => {
      const produce = !configManager.isCommandEnabled("BurnLaborForResourceProduction")
        ? systemCalls.burn_resource_for_resource_production
        : systemCalls.burn_labor_for_resource_production;
      return produce({
        signer,
        from_entity_id: structureId,
        production_cycles: [1],
        produced_resource_types: [ResourcesIds.Wood],
      });
    },
    submit: (signer, act) => captureSubmission(client, heraldConfirmations, awaitingHash, signer.address, act),
    waitFor: (read, timeoutMs, describe) => waitForWorldState(client, read, timeoutMs, describe),
  };
  return game;
}

async function waitUntilPlaying({ setup: { store }, gameId: game_id }: GameClient): Promise<void> {
  const game = store.require("GameRegistry", { game_id });
  const start = Number(game.start_main_at > game.start_settling_at ? game.start_main_at : game.start_settling_at);
  const remaining = Math.max(0, start - getBlockTimestamp().currentBlockTimestamp);
  const deadline = Date.now() + remaining * 1_000 + 120_000;
  while (Date.now() <= deadline) {
    const current = store.require("GameRegistry", { game_id });
    const timestamp = getBlockTimestamp().currentBlockTimestamp;
    if (current.end_at !== 0n && timestamp >= Number(current.end_at)) throw new Error(`Game ${game_id} has ended`);
    if (
      current.ready &&
      (current.dev_mode_on ||
        (timestamp >= Number(current.start_main_at) && timestamp >= Number(current.start_settling_at)))
    )
      return;
    await sleep(1_000);
  }
  throw new Error(`Herald did not confirm game ${game_id} ready at ${start}`);
}

/**
 * The provider announces every hash it sent with the signer that sent it, and a bot submits one action at a time,
 * so the next announcement for this signer is this action's. Confirmation waits explicitly for applied Herald state;
 * queued calls may resolve at submission and cannot serve as that barrier.
 */
const captureSubmission = (
  client: GameClient,
  heraldConfirmations: HeraldConfirmations | undefined,
  awaitingHash: Set<string>,
  signerAddress: string,
  act: () => Promise<unknown>,
): Promise<HarnessSubmission> => {
  const signer = actorKey(signerAddress);
  if (awaitingHash.has(signer)) throw new Error(`Signer ${signerAddress} already has a submission awaiting its hash`);
  awaitingHash.add(signer);
  const provider = client.setup.network.provider;

  return new Promise<HarnessSubmission>((resolve, reject) => {
    const settle = () => {
      awaitingHash.delete(signer);
      provider.off("transactionSubmitted", onSubmitted);
    };
    const onSubmitted = (event: SubmittedEvent) => {
      if (!event.signerAddress || actorKey(event.signerAddress) !== signer) return;
      settle();
      if (!event.ticket) return reject(new Error("Native submission has no ticket identity"));
      const ticket = event.ticket;
      resolve({
        transactionHash: event.transactionHash,
        heraldConfirmedAtMs: heraldConfirmations?.confirmedAt(event.transactionHash),
        confirmed: client.runtime.waitForTransaction(event.transactionHash).then((transaction) => {
          if (transaction.status === "REVERTED") throw new Error(transaction.revertReason ?? "Transaction reverted");
          const outcome = requireNativeExecutionOutcome(transaction.executions, ticket);
          if (outcome.status === "REVERTED") throw new Error(`Native action rejected: ${outcome.statusClass}: ${outcome.reason}`);
        }),
      });
    };
    provider.on("transactionSubmitted", onSubmitted);
    const submitted = act();
    // A failure before the hash is announced is a submit failure; after it, the awaiting side reads the rejection.
    submitted.catch((error: unknown) => {
      settle();
      reject(error);
    });
  });
};

