import {
  FELT_CENTER,
  gameEntityKey,
  multiplyByPrecision,
  waitForWorldState,
  type GameClient,
} from "@bibliothecadao/eternum";
import { buildBlitzSettleCalls } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, TroopTier, TroopType, type Direction, type ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { shortString, type AccountInterface, type Call } from "starknet";

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
 * Settles, provisions, and fields one explorer per structure, doing only what RECS shows is still missing: a runner
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
  const troopTypes = await waitForStartingTroopTypes(game.client, structures);
  await ensureExplorers(game.client, spawns, troopTypes);
  const explorers = await waitForExplorers(game.client, structures);
  return { structures, explorers };
}

const ensureSettlement = async (game: RunnerGame, signer: AccountInterface, username: string): Promise<ID[]> => {
  const settled = settledStructureIds(game.client, signer.address);
  if (settled) return settled;
  await submitAndConfirm(game.client, signer, buildSettleCalls(game, signer, username));
  return waitForWorldState(
    game.client,
    () => settledStructureIds(game.client, signer.address),
    MODEL_UPDATE_TIMEOUT_MS,
    () => `Settlement for ${signer.address} in game ${game.client.gameId}`,
  );
};

const buildSettleCalls = (game: RunnerGame, signer: AccountInterface, username: string): Call[] =>
  buildBlitzSettleCalls({
    blitzSystemsAddress: game.systems.blitzRealm,
    signerAddress: signer.address,
    usernameFelt: shortString.encodeShortString(username),
    gameId: game.client.gameId,
    // The lab world has no VRF provider; settle draws its position without a request_random call.
    vrfProviderAddress: null,
    grantStartingTroops: true,
  });

/** Blitz realms produce nothing until provisioned; a funded T1 balance is the RECS sign it already happened. */
const ensureProvisioned = async (game: RunnerGame, signer: AccountInterface, structures: ID[]): Promise<void> => {
  const unprovisioned = structures.filter((structureId) => startingTroopType(game.client, structureId) === undefined);
  if (unprovisioned.length === 0) return;
  await submitAndConfirm(
    game.client,
    signer,
    unprovisioned.map((structureId) => buildProvisionCall(game, structureId)),
  );
};

/** Provisioning has no client action, so the call is raw; the provider's game_id prefix does not apply to it. */
const buildProvisionCall = (game: RunnerGame, structureId: ID): Call => ({
  contractAddress: game.systems.blitzRealm,
  entrypoint: "provision_realm",
  calldata: [game.client.gameId.toString(), structureId.toString()],
});

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

/** Raw sends confirm through the same Herald transaction channel the client's own actions wait on. */
const submitAndConfirm = async (client: GameClient, signer: AccountInterface, calls: Call[]): Promise<void> => {
  const { transaction_hash } = await signer.execute(calls);
  await client.runtime.waitForTransaction(transaction_hash);
};

// RECS reads

const settledStructureIds = (client: GameClient, player: string): ID[] | undefined =>
  getComponentValue(client.setup.components.BlitzSettlement, gameEntityKey([BigInt(player)]))?.structure_ids;

const structureCoord = (client: GameClient, structureId: ID): Coord | undefined => {
  const structure = getComponentValue(client.setup.components.Structure, gameEntityKey([BigInt(structureId)]));
  return structure ? { x: structure.base.coord_x, y: structure.base.coord_y } : undefined;
};

/** The T1 troop type the structure holds enough of to field one explorer. */
const startingTroopType = (client: GameClient, structureId: ID): TroopType | undefined => {
  const resource = getComponentValue(client.setup.components.Resource, gameEntityKey([BigInt(structureId)]));
  if (!resource) return undefined;
  const required = BigInt(multiplyByPrecision(EXPLORER_TROOP_COUNT));
  const balances = [resource.KNIGHT_T1_BALANCE, resource.PALADIN_T1_BALANCE, resource.CROSSBOWMAN_T1_BALANCE];
  const funded = balances.findIndex((balance) => BigInt(balance) >= required);
  return funded < 0 ? undefined : T1_TROOP_TYPES[funded];
};

// RECS waits

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

/** Every item resolved, or nothing yet: the shape a RECS wait needs for rows that land independently. */
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
