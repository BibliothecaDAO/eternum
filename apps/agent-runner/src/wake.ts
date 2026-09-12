import type { DirectionSource } from "./directions";
import type { RunnerGame } from "./game";
import { logEvent } from "./log";

/** Why the loop woke: the only inputs that can lead to a model call. */
export type WakeReason = "startup" | "world-delta" | "direction" | "heartbeat" | "phase-change";

export type StopReason = "game-ended" | "max-ticks" | "sync-failed" | "interrupted";

/** How a wake reached the agent, if it did; the manifest counts these because each one is a cost decision. */
export type Delivery = "prompted" | "steered" | "followed-up" | "coalesced" | "skipped";

export interface Wake {
  reason: WakeReason;
  direction?: string;
}

export type LoopSignal = { kind: "wake"; wake: Wake } | { kind: "stop"; reason: StopReason };

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface WakeSourcesInput {
  game: RunnerGame;
  directions: DirectionSource;
  clock: Clock;
  /** Slices arrive in bursts; the first one opens a window and every slice inside it folds into one wake at its end. */
  quietWindowMs: number;
  heartbeatMs: number;
  signal?: AbortSignal;
}

export interface WakeSources {
  /** The next signal, in priority order: stop, direction, world delta, heartbeat. */
  next(): Promise<LoopSignal>;
  /** A world-delta wake without waiting for a slice: the loop asks for one when a coalesced update was consumed. */
  requestWorldDelta(): void;
  /** Push the next heartbeat out by a full period, because the agent just got fresh context. */
  restartHeartbeat(): void;
  stop(): void;
}

interface PendingSignals {
  stop: StopReason | null;
  directions: string[];
  worldDelta: boolean;
  heartbeat: boolean;
}

/** Fans every wake source into one queue that coalesces by reason: a burst of slices is one world-delta wake. */
export const createWakeSources = (input: WakeSourcesInput): WakeSources => {
  const { clock } = input;
  const pending: PendingSignals = { stop: null, directions: [], worldDelta: false, heartbeat: false };
  let waiter: ((signal: LoopSignal) => void) | null = null;
  let listening = true;

  const notify = (): void => {
    if (!waiter) return;
    const signal = takePending(pending);
    if (!signal) return;
    const resolve = waiter;
    waiter = null;
    resolve(signal);
  };
  const requestStop = (reason: StopReason): void => {
    pending.stop ??= reason;
    notify();
  };

  const quiet = createResettableTimer(clock, input.quietWindowMs, () => {
    pending.worldDelta = true;
    notify();
  });
  const heartbeat = createResettableTimer(clock, input.heartbeatMs, () => {
    pending.heartbeat = true;
    notify();
    heartbeat.restart();
  });
  heartbeat.restart();

  // A window, not a debounce: a chain that never goes quiet must still wake the loop once per window.
  const unsubscribeSlices = input.game.client.runtime.subscribeSliceApplied(quiet.startIfIdle);
  const unsubscribeSync = input.game.onSyncFailed(() => requestStop("sync-failed"));
  const onAbort = (): void => requestStop("interrupted");
  input.signal?.addEventListener("abort", onAbort, { once: true });
  if (input.signal?.aborted) onAbort();

  const pumpDirections = async (): Promise<void> => {
    while (listening) {
      const direction = await input.directions.next();
      if (direction === null || !listening) return;
      pending.directions.push(direction);
      notify();
    }
  };
  void pumpDirections().catch((error: unknown) => {
    logEvent("agent_runner_directions_failed", { error: error instanceof Error ? error.message : String(error) });
  });

  return {
    next: () => {
      const ready = takePending(pending);
      if (ready) return Promise.resolve(ready);
      return new Promise((resolve) => {
        waiter = resolve;
      });
    },
    requestWorldDelta: () => {
      pending.worldDelta = true;
      notify();
    },
    restartHeartbeat: heartbeat.restart,
    stop: () => {
      listening = false;
      quiet.cancel();
      heartbeat.cancel();
      unsubscribeSlices();
      unsubscribeSync();
      input.signal?.removeEventListener("abort", onAbort);
      input.directions.close();
    },
  };
};

const takePending = (pending: PendingSignals): LoopSignal | null => {
  if (pending.stop) return { kind: "stop", reason: pending.stop };
  const direction = pending.directions.shift();
  if (direction !== undefined) return { kind: "wake", wake: { reason: "direction", direction } };
  if (pending.worldDelta) {
    pending.worldDelta = false;
    return { kind: "wake", wake: { reason: "world-delta" } };
  }
  if (pending.heartbeat) {
    pending.heartbeat = false;
    return { kind: "wake", wake: { reason: "heartbeat" } };
  }
  return null;
};

const createResettableTimer = (clock: Clock, ms: number, fire: () => void) => {
  let handle: unknown = null;
  const cancel = (): void => {
    if (handle === null) return;
    clock.clearTimeout(handle);
    handle = null;
  };
  const restart = (): void => {
    cancel();
    handle = clock.setTimeout(() => {
      handle = null;
      fire();
    }, ms);
  };
  return {
    cancel,
    restart,
    startIfIdle: (): void => {
      if (handle === null) restart();
    },
  };
};
