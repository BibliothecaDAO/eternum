import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { NATIVE_RELEASES } from "../../../../deploy/release/native-release";
import type { NativeReleases } from "../sync/herald-http-types";
import type { NativeFactStore } from "./native-fact-store";
import { GameOnOlderNumbersError, refreshShardRelease, ShardReleaseMismatchError, type Shard } from "./shard";

/** Validate each game pin once, shared by every concurrent sender: an action waits until its pin is readable. */
export function followGameRelease(
  store: NativeFactStore,
  input: { gameId: number; shard: Pick<Shard, "url" | "releases">; schemaIdentity: string },
  onUnknownDecoder: (error: ShardReleaseMismatchError) => void,
) {
  const controller = new AbortController();
  let catalogue = input.shard.releases;
  let validated: NativeRows["GameRelease"] | undefined;
  let validation: { pin: NativeRows["GameRelease"]; promise: Promise<void> } | undefined;
  const pin = () => store.require("GameRelease", { game_id: input.gameId });
  const family = () => store.require("GameRegistry", { game_id: input.gameId }).family;

  const validate = (): Promise<void> => {
    const candidate = pin();
    if (sameReleaseSpan(validated, candidate)) return Promise.resolve();
    if (validation && sameReleaseSpan(validation.pin, candidate)) return validation.promise;
    const promise = validateRelease(candidate)
      .catch((error: unknown) => {
        if (error instanceof ShardReleaseMismatchError) onUnknownDecoder(error);
        throw error;
      })
      .finally(() => {
        if (validation?.promise === promise) validation = undefined;
      });
    validation = { pin: candidate, promise };
    return promise;
  };

  const validateRelease = async (candidate: NativeRows["GameRelease"]): Promise<void> => {
    while (!controller.signal.aborted && sameReleaseSpan(candidate, pin())) {
      const missing = firstUnreadRelease(candidate, family(), catalogue, input.schemaIdentity, input.shard.url);
      if (missing === undefined) {
        validated = candidate;
        return;
      }
      try {
        const shard = await refreshShardRelease(input.shard.url, String(missing), input.schemaIdentity);
        catalogue = shard.releases;
      } catch (error) {
        if (!sameReleaseSpan(candidate, pin())) return;
        if (error instanceof ShardReleaseMismatchError) throw error;
        await waitToRetry(controller.signal);
      }
    }
    controller.signal.throwIfAborted();
  };

  const ready = async (): Promise<void> => {
    do {
      controller.signal.throwIfAborted();
      await validate();
    } while (!sameReleaseSpan(validated, pin()));
  };

  const unsubscribe = store.subscribe((changes) => {
    if (changes.some((change) => change.model === "GameRelease" && change.current?.game_id === input.gameId))
      void validate().catch(() => {}); // Unknown decoders are reported above; transient failures stay in the retry loop.
  });
  return {
    ready,
    dispose: () => {
      unsubscribe();
      controller.abort(new Error("Game release subscription disposed"));
    },
  };
}

function waitToRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1_000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

const sameReleaseSpan = (left: NativeRows["GameRelease"] | undefined, right: NativeRows["GameRelease"]): boolean =>
  left?.release_id === right.release_id && left?.created_release_id === right.created_release_id;

export function assertReleaseReadable(
  pin: NativeRows["GameRelease"],
  family: number,
  catalogue: NativeReleases,
  schema: string,
  shardUrl: string,
): void {
  const span = `${pin.created_release_id}..${pin.release_id}`;
  if (!Number.isSafeInteger(pin.created_release_id) || !Number.isSafeInteger(pin.release_id))
    throw new ShardReleaseMismatchError(shardUrl, span);
  const unread = firstUnreadRelease(pin, family, catalogue, schema, shardUrl);
  if (unread !== undefined) throw new ShardReleaseMismatchError(shardUrl, String(unread));
}

const releaseLineOf = (family: number, shardUrl: string) => {
  const line = Object.values(NATIVE_RELEASES).find((candidate) => candidate.family === family);
  if (!line) throw new ShardReleaseMismatchError(shardUrl, `family ${family}`);
  return line;
};

function firstUnreadRelease(
  pin: NativeRows["GameRelease"],
  family: number,
  catalogue: NativeReleases,
  schema: string,
  shardUrl: string,
): number | undefined {
  if (pin.created_release_id < 1 || pin.created_release_id > pin.release_id)
    throw new ShardReleaseMismatchError(shardUrl, `${pin.created_release_id}..${pin.release_id}`);
  const line = releaseLineOf(family, shardUrl);
  if (pin.release_id < line.since) throw new GameOnOlderNumbersError(shardUrl, String(pin.release_id));
  if (pin.release_id > line.release) throw new ShardReleaseMismatchError(shardUrl, String(pin.release_id));
  for (let release = pin.release_id; ; ) {
    const known = catalogue[String(release)];
    if (known === undefined) return release;
    if (known.family !== family || known.schema !== schema)
      throw new ShardReleaseMismatchError(shardUrl, String(release));
    if (release === pin.created_release_id) return undefined;
    if (known.previous < pin.created_release_id || known.previous >= release)
      throw new ShardReleaseMismatchError(shardUrl, String(release));
    release = known.previous;
  }
}
