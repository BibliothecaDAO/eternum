import {
  FELT_CENTER,
  getBuildingCount,
  multiplyByPrecision,
  ResourceManager,
  waitForWorldState,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  BuildingType,
  ResourcesIds,
  StructureType,
  getNeighborHexes,
  TroopTier,
  TroopType,
  type Direction,
  type ID,
} from "@bibliothecadao/types";
import { shortString, type AccountInterface } from "starknet";

import type { RunnerGame } from "./game";

export interface SettledEmpire {
  structures: ID[];
  explorers: ID[];
}

interface Coord {
  x: number;
  y: number;
}

interface StructureSpawn {
  structureId: ID;
  direction: Direction;
}

const EXPLORER_TROOP_COUNT = 10;
const T1_TROOP_TYPES: readonly TroopType[] = [TroopType.Knight, TroopType.Paladin, TroopType.Crossbowman];
const MODEL_UPDATE_TIMEOUT_MS = 30_000;

/**
 * Settles, provisions, and fields one explorer per structure, doing only what Herald shows is still missing: a runner
 * that restarts mid-way resumes from the rows, not from a local checkpoint.
 */
export async function ensureSettled(
  game: RunnerGame,
  signer: AccountInterface,
  username: string,
): Promise<SettledEmpire> {
  const structures = await ensureSettlement(game, signer, username);
  const spawns = await waitForStructureSpawns(game.client, structures);
  await ensureProvisioned(game, signer, structures);
  const missingExplorers = structures.filter((id) => game.client.views.explorers(id).length === 0);
  const troopTypes = await waitForStartingTroopTypes(game.client, missingExplorers);
  await ensureExplorers(game.client, spawns, troopTypes);
  const explorers = await waitForExplorers(game.client, structures);
  return { structures, explorers };
}

const ensureSettlement = async (game: RunnerGame, signer: AccountInterface, username: string): Promise<ID[]> => {
  const settled = settledStructureIds(game.client, signer.address);
  if (settled) return settled;
  const [owner] = await signer.callContract({
    contractAddress: game.client.world.playerRegistryAddress,
    entrypoint: "owner_of",
    calldata: [signer.address],
  });
  if (!owner || BigInt(owner) === 0n) throw new Error("Gameplay account is not bound");
  await game.client.setup.systemCalls.settle_blitz({
    signer,
    name: shortString.encodeShortString(username),
    owner,
    cosmeticsBlockHash: "0x0",
    cosmeticsBlockNumber: 0,
    cosmetics: [],
    grantStartingTroops: true,
  });
  return waitForWorldState(
    game.client,
    () => settledStructureIds(game.client, signer.address),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Settlement for ${signer.address} in game ${game.client.gameId}`,
  );
};

/** The contract permits provisioning exactly until the realm has its first Labor building. */
const ensureProvisioned = async (game: RunnerGame, signer: AccountInterface, structures: ID[]): Promise<void> => {
  const unprovisioned = structures.filter((id) => {
    const row = game.client.setup.store.get("StructureBuildings", { game_id: game.client.gameId, entity_id: id });
    // Settlement creates no building-count row. The contract reads zero counts until the first building is placed.
    if (!row) return true;
    return (
      getBuildingCount(BuildingType.ResourceLabor, [row.packed_counts_1, row.packed_counts_2, row.packed_counts_3]) ===
      0
    );
  });
  if (unprovisioned.length === 0) return;
  for (const realm_entity_id of unprovisioned) {
    await game.client.setup.systemCalls.provision_realm({ signer, realm_entity_id });
  }
};

const ensureExplorers = async (
  client: GameClient,
  spawns: StructureSpawn[],
  troopTypes: Map<ID, TroopType>,
): Promise<void> => {
  for (const spawn of spawns) {
    if (client.views.explorers(spawn.structureId).length > 0) continue;
    await client.actions.createExplorerArmy({
      structureId: spawn.structureId,
      troopType: troopTypes.get(spawn.structureId)!,
      troopTier: TroopTier.T1,
      troopCount: EXPLORER_TROOP_COUNT,
      spawnDirection: spawn.direction,
    });
  }
};

// Native facts

const settledStructureIds = (client: GameClient, player: string): ID[] | undefined => {
  const entered = [...client.setup.store.inGame("PlayerEntry", client.gameId)].some(
    (entry) => entry.player === BigInt(player),
  );
  if (!entered) return undefined;
  return [...client.setup.store.structuresOwnedBy(client.gameId, BigInt(player))]
    .filter((row) => row.base.category === StructureType.Realm)
    .map((row) => row.entity_id);
};

const structureCoord = (client: GameClient, structureId: ID): Coord | undefined => {
  const structure = client.setup.store.get("Structure", { game_id: client.gameId, entity_id: structureId });
  return structure ? { x: structure.base.coord_x, y: structure.base.coord_y } : undefined;
};

/** The T1 troop type the structure holds enough of to field one explorer. */
const startingTroopType = (client: GameClient, structureId: ID): TroopType | undefined => {
  const resource = new ResourceManager(client.setup.store, structureId);
  const required = BigInt(multiplyByPrecision(EXPLORER_TROOP_COUNT));
  const balances = [ResourcesIds.Knight, ResourcesIds.Paladin, ResourcesIds.Crossbowman].map((id) =>
    resource.balance(id),
  );
  const funded = balances.findIndex((balance) => BigInt(balance) >= required);
  return funded < 0 ? undefined : T1_TROOP_TYPES[funded];
};

// Stream barriers

const waitForStructureSpawns = (client: GameClient, structures: ID[]): Promise<StructureSpawn[]> =>
  waitForWorldState(
    client,
    () =>
      collectAll(structures, (structureId) => {
        const coord = structureCoord(client, structureId);
        return coord && { structureId, direction: chooseOutwardDirection(coord) };
      }),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Structures ${structures.join(", ")}`,
  );

const waitForStartingTroopTypes = async (client: GameClient, structures: ID[]): Promise<Map<ID, TroopType>> => {
  const troopTypes = await waitForWorldState(
    client,
    () => collectAll(structures, (structureId) => startingTroopType(client, structureId)),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Starting troops of structures ${structures.join(", ")}`,
  );
  return new Map(structures.map((structureId, index) => [structureId, troopTypes[index]!]));
};

const waitForExplorers = (client: GameClient, structures: ID[]): Promise<ID[]> =>
  waitForWorldState(
    client,
    () => collectAll(structures, (structureId) => client.views.explorers(structureId)[0]?.entityId),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Explorers of structures ${structures.join(", ")}`,
  );

/** Every item resolved, or nothing yet: the shape a stream barrier needs for rows that land independently. */
const collectAll = <T, R>(items: readonly T[], read: (item: T) => R | undefined): R[] | undefined => {
  const collected: R[] = [];
  for (const item of items) {
    const value = read(item);
    if (value === undefined) return undefined;
    collected.push(value);
  }
  return collected;
};

/** Spawn away from the map centre, where the neighbouring hex is least likely to be another settlement's. */
const chooseOutwardDirection = (coord: Coord): Direction => {
  const center = { x: FELT_CENTER(), y: FELT_CENTER() };
  const distanceFromCenter = (hex: { col: number; row: number }) => Math.hypot(hex.col - center.x, hex.row - center.y);
  return getNeighborHexes(coord.x, coord.y)
    .map((hex) => ({ direction: hex.direction, distance: distanceFromCenter(hex) }))
    .sort((left, right) => right.distance - left.distance || left.direction - right.direction)[0]!.direction;
};

export const defaultUsername = (signerAddress: string): string => `agent-${signerAddress.slice(-6)}`;
