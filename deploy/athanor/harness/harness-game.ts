import { requireNativeExecutionOutcome } from "@bibliothecadao/provider";
import {
  buildArmyPathIndexes,
  configManager,
  createGameActions,
  FELT_CENTER,
  getBlockTimestamp,
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
}

interface SubmittedEvent {
  ticket?: NativeTicketIdentity;
  signerAddress?: string;
  transactionHash: string;
}

/** The game as the harness plays it: native facts, the projection's occupancy, and per-bot action facades over one client. */
export interface HarnessGame {
  gameId: number;
  /** Actions signed by this bot; every bot gets its own facade over the shared world. */
  actionsFor(signer: Account): GameActions;
  currentTicks(): ChainTicks;
  mapCenter(): Coord;
  settlementStructureIds(player: string): ID[] | undefined;
  structureCoord(structureId: ID): Coord | undefined;
  /** The T1 troop type the structure holds enough of to field one harness explorer. */
  startingTroopType(structureId: ID): TroopType | undefined;
  explorerOf(structureId: ID): ID | undefined;
  explorer(explorerId: ID): ExplorerRow | undefined;
  explorerStamina(explorerId: ID, armiesTick: number): number;
  explorerMaxStamina(explorerId: ID): number;
  /** The cheapest stamina an action of this kind can cost under the game's rulebook. */
  minimumStaminaFor(kind: "move" | "explore"): number;
  production(structureId: ID): ProductionState | undefined;
  armyPathIndexes(): ArmyPathIndexes;
  settle(signer: Account, owner: string, name: string, gameType: "blitz" | "eternum"): Promise<unknown>;
  produceWood(signer: Account, structureId: ID): Promise<unknown>;
  /** Runs a client action and resolves with its hash as soon as the chain accepted it; one at a time per signer. */
  submit(signer: Account, act: () => Promise<unknown>): Promise<HarnessSubmission>;
  /** Resolves once `read` returns a value; re-read after every applied sync slice. */
  waitFor<T>(read: () => T | undefined, timeoutMs: number, describe: () => string): Promise<T>;
}

export const EXPLORER_TROOP_COUNT = 10;
const T1_TROOP_TYPES: readonly TroopType[] = [TroopType.Knight, TroopType.Paladin, TroopType.Crossbowman];

export function createHarnessGame(client: GameClient): HarnessGame {
  const { store, systemCalls } = client.setup;
  const game_id = client.gameId;
  const awaitingHash = new Set<string>();

  return {
    gameId: client.gameId,
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
    explorerOf: (structureId) => {
      const explorers = client.views.explorers(structureId);
      return explorers.length === 1 ? explorers[0]!.entityId : undefined;
    },
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
    settle: (signer, _owner, name) => systemCalls.settle_season({ signer, name: shortString.encodeShortString(name) }),
    produceWood: (signer, structureId) => {
      const produce = configManager.getBlitzConfig().blitz_mode_on
        ? systemCalls.burn_resource_for_resource_production
        : systemCalls.burn_labor_for_resource_production;
      return produce({
        signer,
        from_entity_id: structureId,
        production_cycles: [1],
        produced_resource_types: [ResourcesIds.Wood],
      });
    },
    submit: (signer, act) => captureSubmission(client, awaitingHash, signer.address, act),
    waitFor: (read, timeoutMs, describe) => waitForWorldState(client, read, timeoutMs, describe),
  };
}

/**
 * The provider announces every hash it sent with the signer that sent it, and a bot submits one action at a time,
 * so the next announcement for this signer is this action's. Confirmation waits explicitly for applied Herald state;
 * queued calls may resolve at submission and cannot serve as that barrier.
 */
const captureSubmission = (
  client: GameClient,
  awaitingHash: Set<string>,
  signerAddress: string,
  act: () => Promise<unknown>,
): Promise<HarnessSubmission> => {
  const signer = normalizeAddress(signerAddress);
  if (awaitingHash.has(signer)) throw new Error(`Signer ${signerAddress} already has a submission awaiting its hash`);
  awaitingHash.add(signer);
  const provider = client.setup.network.provider;

  return new Promise<HarnessSubmission>((resolve, reject) => {
    const settle = () => {
      awaitingHash.delete(signer);
      provider.off("transactionSubmitted", onSubmitted);
    };
    const onSubmitted = (event: SubmittedEvent) => {
      if (!event.signerAddress || normalizeAddress(event.signerAddress) !== signer) return;
      settle();
      if (!event.ticket) return reject(new Error("Native submission has no ticket identity"));
      const ticket = event.ticket;
      resolve({
        transactionHash: event.transactionHash,
        confirmed: client.runtime.waitForTransaction(event.transactionHash).then((transaction) => {
          if (transaction.status === "REVERTED") throw new Error(transaction.revertReason ?? "Transaction reverted");
          const outcome = requireNativeExecutionOutcome(transaction.executions, ticket);
          if (outcome.status === "REVERTED") throw new Error(`Native action rejected: ${outcome.reason}`);
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

const normalizeAddress = (address: string): string => `0x${BigInt(address).toString(16)}`;
