export interface WorldmapExactTerrainPreparation<TResult> {
  readonly chunkKey: string;
  readonly transitionToken: number;
  readonly promise: Promise<TResult>;
}

export type WorldmapExactTerrainJoinResult =
  | { status: "exact_ready" }
  | {
      status: "fallback_required";
      reason: "cancelled" | "failed" | "missing" | "superseded" | "timed_out" | "unavailable";
    };

interface StartWorldmapExactTerrainPreparationInput<TResult> {
  chunkKey: string;
  transitionToken: number;
  prepare: () => Promise<TResult>;
}

interface WaitForWorldmapExactTerrainPreparationInput<TResult> {
  chunkKey: string;
  transitionToken: number;
  timeoutMs: number;
  isExactReady: (result: TResult) => boolean;
}

interface WorldmapExactTerrainPreparationEntry<TResult> extends WorldmapExactTerrainPreparation<TResult> {
  cancelled: Promise<void>;
  cancel: () => void;
}

export class WorldmapExactTerrainPreparationRuntime<TResult> {
  private readonly entries = new Map<string, WorldmapExactTerrainPreparationEntry<TResult>>();

  start(input: StartWorldmapExactTerrainPreparationInput<TResult>): WorldmapExactTerrainPreparation<TResult> {
    this.releaseSuperseded(input.transitionToken);

    const current = this.entries.get(input.chunkKey);
    if (current?.transitionToken === input.transitionToken) {
      return current;
    }
    if (current && current.transitionToken > input.transitionToken) {
      throw new Error(
        `Cannot start stale exact terrain preparation ${input.chunkKey}@${input.transitionToken}; ` +
          `newer owner ${current.transitionToken} exists`,
      );
    }
    if (current) {
      this.release(current);
    }

    const entry = this.createEntry(input);
    this.entries.set(input.chunkKey, entry);
    return entry;
  }

  async waitForExact(
    input: WaitForWorldmapExactTerrainPreparationInput<TResult>,
  ): Promise<WorldmapExactTerrainJoinResult> {
    const entry = this.entries.get(input.chunkKey);
    if (!entry) {
      return { status: "fallback_required", reason: "missing" };
    }
    if (entry.transitionToken !== input.transitionToken) {
      return { status: "fallback_required", reason: "superseded" };
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        entry.promise.then(
          (result): WorldmapExactTerrainJoinResult =>
            input.isExactReady(result)
              ? { status: "exact_ready" }
              : { status: "fallback_required", reason: "unavailable" },
          (): WorldmapExactTerrainJoinResult => ({ status: "fallback_required", reason: "failed" }),
        ),
        entry.cancelled.then(
          (): WorldmapExactTerrainJoinResult => ({ status: "fallback_required", reason: "cancelled" }),
        ),
        new Promise<WorldmapExactTerrainJoinResult>((resolve) => {
          timeoutId = setTimeout(
            () => {
              resolve({ status: "fallback_required", reason: "timed_out" });
            },
            Math.max(0, input.timeoutMs),
          );
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  release(preparation: WorldmapExactTerrainPreparation<TResult>): void {
    const current = this.entries.get(preparation.chunkKey);
    if (current !== preparation) {
      return;
    }

    current.cancel();
    this.entries.delete(preparation.chunkKey);
  }

  releaseSuperseded(latestTransitionToken: number): void {
    this.entries.forEach((entry) => {
      if (entry.transitionToken < latestTransitionToken) {
        this.release(entry);
      }
    });
  }

  clear(): void {
    this.entries.forEach((entry) => entry.cancel());
    this.entries.clear();
  }

  private createEntry(
    input: StartWorldmapExactTerrainPreparationInput<TResult>,
  ): WorldmapExactTerrainPreparationEntry<TResult> {
    let cancel: () => void = () => undefined;
    const cancelled = new Promise<void>((resolve) => {
      cancel = resolve;
    });

    let promise: Promise<TResult>;
    try {
      promise = input.prepare();
    } catch (error) {
      promise = Promise.reject(error);
    }

    return {
      chunkKey: input.chunkKey,
      transitionToken: input.transitionToken,
      promise,
      cancelled,
      cancel,
    };
  }
}
