import {
  assertReleaseReadable,
  fetchHeraldGameSnapshot,
  NativeFactStore,
  ShardReleaseMismatchError,
} from "@bibliothecadao/eternum/game-client";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { NativeReleases } from "@bibliothecadao/eternum/game-sync";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

const MANIFEST_TIMEOUT_MS = 10_000;

export type ReleaseCatalogue = NativeReleases;

/** The shard's release catalogue, the one the game client checks a game's pins against. */
export const readReleaseCatalogue = async (shardUrl: string): Promise<ReleaseCatalogue> => {
  const response = await fetch(`${shardUrl}/manifest`, {
    signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`${shardUrl}/manifest answered ${response.status}`);
  const { releases } = (await response.json()) as { releases?: ReleaseCatalogue };
  if (typeof releases !== "object" || releases === null) throw new Error(`${shardUrl}/manifest names no releases`);
  return releases;
};

/**
 * Throws ShardReleaseMismatchError unless every release from the game's creation to its pin is one this code reads; a
 * game that shows no pin is one it cannot read.
 */
export const assertPinReadable = (
  shardUrl: string,
  pin: NativeRows["GameRelease"] | undefined,
  family: number | undefined,
  catalogue: ReleaseCatalogue,
): void => {
  if (!pin) throw new ShardReleaseMismatchError(shardUrl, "no release pin");
  if (family === undefined) throw new ShardReleaseMismatchError(shardUrl, "no game family");
  assertReleaseReadable(pin, family, catalogue, bindings.schemaIdentity, shardUrl);
};

/**
 * One game's confirmed facts for these models, read as the player's scope allows; refused before anything interprets
 * them when the game's releases are not ones this code reads. The catalogue is read once by the caller's pass.
 */
export const readGameFacts = async (
  shardUrl: string,
  gameId: number,
  models: readonly string[],
  now: number,
  scope: { actor: string; owner?: string },
  catalogue: ReleaseCatalogue,
): Promise<NativeFactStore> => {
  const snapshot = await fetchHeraldGameSnapshot(
    { url: shardUrl },
    gameId,
    [...models, "GameRelease", "GameRegistry"],
    scope.actor,
    scope.owner,
  );
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error(`Snapshot read another game than ${gameId}`);
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))),
  );
  assertPinReadable(
    shardUrl,
    store.get("GameRelease", { game_id: gameId }),
    store.get("GameRegistry", { game_id: gameId })?.family,
    catalogue,
  );
  store.setSnapshot({ gameId, actor: scope.actor, complete: true, timestamp: Math.floor(now / 1000) });
  return store;
};
