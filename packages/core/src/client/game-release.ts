import type { NativeFactStore } from "./native-fact-store";
import { refreshShardRelease, ShardReleaseMismatchError, type Shard } from "./shard";

/** Validate each game pin once, shared by every concurrent sender: an action waits until its pin is readable. */
export function followGameRelease(
  store: NativeFactStore,
  input: { gameId: number; shard: Pick<Shard, "url" | "releaseSchemas">; schemaIdentity: string },
  onUnknownDecoder: (error: ShardReleaseMismatchError) => void,
) {
  const controller = new AbortController();
  let catalogue = input.shard.releaseSchemas;
  let validated: number | undefined;
  let validation: { releaseId: number; promise: Promise<void> } | undefined;
  const pin = () => store.require("GameRelease", { game_id: input.gameId }).release_id;

  const validate = (): Promise<void> => {
    const releaseId = pin();
    if (validated === releaseId) return Promise.resolve();
    if (validation?.releaseId === releaseId) return validation.promise;
    const promise = validateRelease(releaseId)
      .catch((error: unknown) => {
        if (error instanceof ShardReleaseMismatchError) onUnknownDecoder(error);
        throw error;
      })
      .finally(() => {
        if (validation?.promise === promise) validation = undefined;
      });
    validation = { releaseId, promise };
    return promise;
  };

  const validateRelease = async (releaseId: number): Promise<void> => {
    while (!controller.signal.aborted && pin() === releaseId) {
      const knownSchema = catalogue[String(releaseId)];
      if (knownSchema !== undefined) {
        if (knownSchema !== input.schemaIdentity)
          throw new ShardReleaseMismatchError(input.shard.url, String(releaseId));
        validated = releaseId;
        return;
      }
      try {
        const shard = await refreshShardRelease(input.shard.url, String(releaseId), input.schemaIdentity);
        catalogue = shard.releaseSchemas;
      } catch (error) {
        if (pin() !== releaseId) return;
        if (error instanceof ShardReleaseMismatchError) throw error;
        // Manifest availability does not invalidate the live fact stream. Keep actions gated and retry.
        await waitToRetry(controller.signal);
      }
    }
    controller.signal.throwIfAborted();
  };

  const ready = async (): Promise<void> => {
    do {
      controller.signal.throwIfAborted();
      await validate();
    } while (validated !== pin());
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
