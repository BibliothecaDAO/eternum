import {
  configManager,
  createGameActions,
  FELT_CENTER,
  gameEntityKey,
  multiplyByPrecision,
  type GameActions,
  type GameClient,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import type { Account } from "starknet";
import {
  BiomeIdToType,
  ContractAddress,
  ResourcesIds,
  TickIds,
  TroopType,
  type BiomeType,
  type HexEntityInfo,
  type ID,
} from "../../../packages/types";

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

type HexIndex<T> = Map<number, Map<number, T>>;

/** The occupancy armyPaths plans around, keyed the way the scenes key it: normalized col, then row. */
interface ArmyPathIndexes {
  structureHexes: HexIndex<HexEntityInfo>;
  armyHexes: HexIndex<HexEntityInfo>;
  exploredHexes: HexIndex<BiomeType>;
  chestHexes: HexIndex<HexEntityInfo>;
}

/** A transaction the chain accepted into its mempool; `confirmed` is the client's own wait on Herald's stream. */
export interface HarnessSubmission {
  transactionHash: string;
  confirmed?: Promise<unknown>;
}

interface SubmittedEvent {
  signerAddress?: string;
  transactionHash: string;
}

/** The game as the harness plays it: RECS facts, the projection's occupancy, and per-bot action facades over one client. */
export interface HarnessGame {
  gameId: number;
  /** Actions signed by this bot; every bot gets its own facade over the shared world. */
  actionsFor(signer: Account): GameActions;
  ticksAt(blockTimestampSeconds: number): ChainTicks;
  mapCenter(): Coord;
  settlementStructureIds(player: string): ID[] | undefined;
  structureCoord(structureId: ID): Coord | undefined;
  /** The T1 troop type the structure holds enough of to field one harness explorer. */
  startingTroopType(structureId: ID): TroopType | undefined;
  explorerOf(structureId: ID): ID | undefined;
  explorer(explorerId: ID): ExplorerRow | undefined;
  explorerStamina(explorerId: ID, armiesTick: number): number;
  /** The cheapest stamina an action of this kind can cost under the game's rulebook. */
  minimumStaminaFor(kind: "move" | "explore"): number;
  production(structureId: ID): ProductionState | undefined;
  armyPathIndexes(): ArmyPathIndexes;
  produceWood(signer: Account, structureId: ID): Promise<unknown>;
  /** Runs a client action and resolves with its hash as soon as the chain accepted it; one at a time per signer. */
  submit(signer: Account, act: () => Promise<unknown>): Promise<HarnessSubmission>;
  /** Resolves once `read` returns a value; re-read after every applied sync slice. */
  waitFor<T>(read: () => T | undefined, timeoutMs: number, describe: () => string): Promise<T>;
}

export const EXPLORER_TROOP_COUNT = 10;
const T1_TROOP_TYPES: readonly TroopType[] = [TroopType.Knight, TroopType.Paladin, TroopType.Crossbowman];

export function createHarnessGame(client: GameClient): HarnessGame {
  const { components } = client.setup;
  const awaitingHash = new Set<string>();

  return {
    gameId: client.gameId,
    actionsFor: (signer) => createGameActions(client, { signer }),
    ticksAt: (timestamp) => ({
      armies: Math.floor(timestamp / configuredTickSeconds(TickIds.Armies)),
      default: Math.floor(timestamp / configuredTickSeconds(TickIds.Default)),
    }),
    mapCenter: () => ({ x: FELT_CENTER(), y: FELT_CENTER() }),
    settlementStructureIds: (player) =>
      getComponentValue(components.BlitzSettlement, gameEntityKey([BigInt(player)]))?.structure_ids,
    structureCoord: (structureId) => {
      const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(structureId)]));
      return structure ? { x: structure.base.coord_x, y: structure.base.coord_y } : undefined;
    },
    startingTroopType: (structureId) => {
      const resource = getComponentValue(components.Resource, gameEntityKey([BigInt(structureId)]));
      if (!resource) return undefined;
      const required = BigInt(multiplyByPrecision(EXPLORER_TROOP_COUNT));
      const balances = [resource.KNIGHT_T1_BALANCE, resource.PALADIN_T1_BALANCE, resource.CROSSBOWMAN_T1_BALANCE];
      const funded = balances.findIndex((balance) => BigInt(balance) >= required);
      if (funded < 0) throw new Error(`Structure ${structureId} has no funded T1 troop type`);
      return T1_TROOP_TYPES[funded];
    },
    explorerOf: (structureId) => {
      const explorers = client.views.explorers(structureId);
      return explorers.length === 1 ? explorers[0]!.entityId : undefined;
    },
    explorer: (explorerId) => {
      const row = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(explorerId)]));
      if (!row) return undefined;
      return {
        coord: { x: row.coord.x, y: row.coord.y },
        staminaAmount: BigInt(row.troops.stamina.amount),
        staminaUpdatedTick: BigInt(row.troops.stamina.updated_tick),
      };
    },
    explorerStamina: (explorerId, armiesTick) => Number(client.views.stamina(explorerId).getStamina(armiesTick).amount),
    minimumStaminaFor: (kind) =>
      kind === "explore" ? configManager.getExploreStaminaCost() : configManager.getMinTravelStaminaCost(),
    production: (structureId) => {
      const resource = getComponentValue(components.Resource, gameEntityKey([BigInt(structureId)]));
      if (!resource) return undefined;
      return {
        laborBalance: BigInt(resource.LABOR_BALANCE),
        woodOutput: BigInt(resource.WOOD_PRODUCTION.output_amount_left),
      };
    },
    armyPathIndexes: () => buildArmyPathIndexes(client),
    produceWood: (signer, structureId) =>
      client.setup.systemCalls.burn_labor_for_resource_production({
        signer,
        from_entity_id: structureId,
        production_cycles: [1],
        produced_resource_types: [ResourcesIds.Wood],
      }),
    submit: (signer, act) => captureSubmission(client, awaitingHash, signer.address, act),
    waitFor: (read, timeoutMs, describe) => waitForWorldState(client, read, timeoutMs, describe),
  };
}

const configuredTickSeconds = (tick: TickIds): number => {
  const seconds = Number(configManager.getTick(tick));
  if (!(seconds > 0)) throw new Error(`Tick ${TickIds[tick]} has no configured interval`);
  return seconds;
};

/** Bots play the surface layer; owners come from RECS so armyPaths can tell a bot's own units from targets. */
const buildArmyPathIndexes = (client: GameClient): ArmyPathIndexes => {
  const { components } = client.setup;
  const projection = client.projection;
  const structureOwner = (structureId: ID): ContractAddress =>
    ContractAddress(getComponentValue(components.Structure, gameEntityKey([BigInt(structureId)]))?.owner ?? 0n);
  const armyOwner = (explorerId: ID): ContractAddress => {
    const home = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(explorerId)]))?.owner;
    return home === undefined ? ContractAddress(0n) : structureOwner(home);
  };

  const structureHexes: HexIndex<HexEntityInfo> = new Map();
  for (const structure of projection.getStructures(false)) {
    if (structure.reserved) continue;
    indexHex(structureHexes, structure.hexCoords, { id: structure.entityId, owner: structureOwner(structure.entityId) });
  }
  const armyHexes: HexIndex<HexEntityInfo> = new Map();
  for (const army of projection.getArmies(false)) {
    indexHex(armyHexes, army.hexCoords, { id: army.entityId, owner: armyOwner(army.entityId) });
  }
  const exploredHexes: HexIndex<BiomeType> = new Map();
  for (const tile of projection.getTiles(false)) indexHex(exploredHexes, tile.hexCoords, biomeTypeOf(tile.biome));
  const chestHexes: HexIndex<HexEntityInfo> = new Map();
  for (const chest of projection.getChests(false)) {
    indexHex(chestHexes, chest.hexCoords, { id: chest.entityId, owner: ContractAddress(0n) });
  }
  return { structureHexes, armyHexes, exploredHexes, chestHexes };
};

const indexHex = <T>(index: HexIndex<T>, hex: { col: number; row: number }, value: T): void => {
  const col = hex.col - FELT_CENTER();
  const row = index.get(col) ?? new Map<number, T>();
  row.set(hex.row - FELT_CENTER(), value);
  index.set(col, row);
};

const biomeTypeOf = (biomeId: number): BiomeType => {
  const biome = BiomeIdToType[biomeId];
  if (!biome) throw new Error(`Tile carries unknown biome id ${biomeId}`);
  return biome;
};

/**
 * The provider announces every hash it sent with the signer that sent it, and a bot submits one action at a time,
 * so the next announcement for this signer is this action's. The action itself resolves once the client saw the
 * transaction on Herald's stream (the provider waits on runtime.waitForTransaction) or gave up on it.
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
      resolve({ transactionHash: event.transactionHash, confirmed });
    };
    provider.on("transactionSubmitted", onSubmitted);
    const confirmed = act();
    // A failure before the hash is announced is a submit failure; after it, the awaiting side reads the rejection.
    confirmed.catch((error: unknown) => {
      settle();
      reject(error);
    });
  });
};

const normalizeAddress = (address: string): string => `0x${BigInt(address).toString(16)}`;

const waitForWorldState = <T>(
  client: GameClient,
  read: () => T | undefined,
  timeoutMs: number,
  describe: () => string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`${describe()} did not reach the required state within ${timeoutMs / 1_000} seconds`));
    }, timeoutMs);
    const check = () => {
      try {
        const value = read();
        if (value === undefined) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      } catch (error) {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      }
    };
    unsubscribe = client.runtime.subscribeSliceApplied(check);
    check();
  });
