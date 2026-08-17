export interface WorldmapChunkTransitionRuntimeState {
  activePromise: Promise<void> | null;
  isTransitioning: boolean;
}

export interface WorldmapChunkTransitionHardTimeoutInfo {
  timeoutMs: number;
}

interface WorldmapChunkTransitionTimeoutRecoveryInput {
  currentTransitionToken: number;
  timedOutTransitionToken: number;
}

interface WorldmapChunkTransitionTimeoutRecoveryDecision {
  recoveryTransitionToken: number;
  shouldInvalidateTimedOutTransition: boolean;
}

interface RunWorldmapChunkTransitionInput<TTransitionPromise extends Promise<unknown>, TResult> {
  onFinally?: () => void | Promise<void>;
  onResolved: (value: Awaited<TTransitionPromise>) => TResult | Promise<TResult>;
  onTransitionStart?: () => void | Promise<void>;
  yieldFrame?: () => Promise<void>;
  state: WorldmapChunkTransitionRuntimeState;
  transitionPromise: TTransitionPromise;
  hardTimeoutMs?: number;
  onHardTimeout?: (info: WorldmapChunkTransitionHardTimeoutInfo) => TResult | Promise<TResult>;
}

export function createWorldmapChunkTransitionRuntimeState(): WorldmapChunkTransitionRuntimeState {
  return {
    activePromise: null,
    isTransitioning: false,
  };
}

export function resolveWorldmapChunkTransitionTimeoutRecovery(
  input: WorldmapChunkTransitionTimeoutRecoveryInput,
): WorldmapChunkTransitionTimeoutRecoveryDecision {
  if (input.currentTransitionToken !== input.timedOutTransitionToken) {
    return {
      recoveryTransitionToken: input.currentTransitionToken,
      shouldInvalidateTimedOutTransition: false,
    };
  }

  return {
    recoveryTransitionToken: input.currentTransitionToken + 1,
    shouldInvalidateTimedOutTransition: true,
  };
}

type RaceOutcome<T> =
  | { status: "resolved"; value: T }
  | { status: "rejected"; error: unknown }
  | { status: "timed_out" };

export async function runWorldmapChunkTransition<TTransitionPromise extends Promise<unknown>, TResult>(
  input: RunWorldmapChunkTransitionInput<TTransitionPromise, TResult>,
): Promise<TResult> {
  input.state.isTransitioning = true;
  let ownershipPromise: Promise<void> | null = null;
  const transitionRunPromise = runBoundedWorldmapChunkTransition(input, () => ownershipPromise);
  ownershipPromise = transitionRunPromise.then(() => undefined);
  ownershipPromise.catch(() => undefined);
  input.state.activePromise = ownershipPromise;

  return await transitionRunPromise;
}

async function runBoundedWorldmapChunkTransition<TTransitionPromise extends Promise<unknown>, TResult>(
  input: RunWorldmapChunkTransitionInput<TTransitionPromise, TResult>,
  getOwnershipPromise: () => Promise<void> | null,
): Promise<TResult> {
  await input.onTransitionStart?.();
  if (input.yieldFrame) {
    await input.yieldFrame();
  } else if (typeof requestAnimationFrame !== "undefined") {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const hasHardTimeout =
      input.hardTimeoutMs !== undefined && input.hardTimeoutMs > 0 && input.onHardTimeout !== undefined;

    if (hasHardTimeout) {
      const hardTimeoutMs = input.hardTimeoutMs!;
      const settled: Promise<RaceOutcome<Awaited<TTransitionPromise>>> = input.transitionPromise.then(
        (value) => ({ status: "resolved" as const, value: value as Awaited<TTransitionPromise> }),
        (error) => ({ status: "rejected" as const, error }),
      );
      // Prevent later rejection from the underlying promise from becoming unhandled
      // when we have already moved past the race due to the hard timeout firing.
      settled.catch(() => undefined);

      const timed = new Promise<RaceOutcome<Awaited<TTransitionPromise>>>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve({ status: "timed_out" });
        }, hardTimeoutMs);
      });

      const outcome = await Promise.race([settled, timed]);

      if (outcome.status === "timed_out") {
        return await input.onHardTimeout!({ timeoutMs: hardTimeoutMs });
      }

      if (outcome.status === "rejected") {
        throw outcome.error;
      }

      return await input.onResolved(outcome.value);
    }

    const value = await input.transitionPromise;
    return await input.onResolved(value as Awaited<TTransitionPromise>);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    await input.onFinally?.();
    if (input.state.activePromise === getOwnershipPromise()) {
      input.state.activePromise = null;
      input.state.isTransitioning = false;
    }
  }
}
