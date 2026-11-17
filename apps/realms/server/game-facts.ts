import { assertReleaseReadable, fetchHeraldGameSnapshot, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

const MANIFEST_TIMEOUT_MS = 10_000;

/** The shard's release catalogue, the one the game client checks a game's pins against. */
const readReleaseSchemas = async (shardUrl: string): Promise<Record<string, string>> => {
  const response = await fetch(`${shardUrl}/manifest`, {
    signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`${shardUrl}/manifest answered ${response.status}`);
  const { releaseSchemas } = (await response.json()) as { releaseSchemas?: Record<string, string> };
  if (typeof releaseSchemas !== "object" || releaseSchemas === null)
    throw new Error(`${shardUrl}/manifest names no release schemas`);
  return releaseSchemas;
};

/** Throws ShardReleaseMismatchError unless every release from the game's creation to its pin is one this code reads. */
export const requireReadableRelease = async (
  shardUrl: string,
  pin: NativeRows["GameRelease"] | undefined,
): Promise<void> => {
  if (!pin) throw new Error(`${shardUrl} served no release pin for the game`);
  assertReleaseReadable(pin, await readReleaseSchemas(shardUrl), bindings.schemaIdentity, shardUrl);
};

/**
 * One game's confirmed facts for these models, read as the player's scope allows; refused before anything interprets
 * them when the game's releases are not ones this code reads.
 */
export const readGameFacts = async (
  shardUrl: string,
  gameId: number,
  models: readonly string[],
  now: number,
  scope: { actor: string; owner?: string },
): Promise<NativeFactStore> => {
  const snapshot = await fetchHeraldGameSnapshot(
    { url: shardUrl },
    gameId,
    [...models, "GameRelease"],
    scope.actor,
    scope.owner,
  );
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error(`Snapshot read another game than ${gameId}`);
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))),
  );
  await requireReadableRelease(shardUrl, store.get("GameRelease", { game_id: gameId }));
  store.setSnapshot({ gameId, actor: scope.actor, complete: true, timestamp: Math.floor(now / 1000) });
  return store;
};
