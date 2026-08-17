import type { ToriiCancelableSubscription } from "./torii-subscription-setup";
import {
  hasToriiStreamLifecycleSignals,
  observeToriiStreamLifecycle,
  type ToriiStreamCloseHandler,
} from "./torii-stream-lifecycle-observer";

const EVENT_STREAM_LEASE_MS = 60_000;
const MAX_EVENT_STREAM_RETRY_MS = 8_000;

interface RecoveringToriiEventSubscriptionInput {
  createSubscription: () => Promise<ToriiCancelableSubscription>;
  establishReplayBaseline?: () => Promise<void>;
  captureReplayWatermark?: () => unknown;
  replaySince?: (watermark: unknown) => Promise<number>;
  onGapFillReplayed?: (replayedEventCount: number) => void;
  onLost: (reason: string) => void;
  onRestored: () => void;
  attemptTimeoutMs?: number;
  leaseMs?: number;
  retryDelayMs?: (attempt: number) => number;
}

const defaultRetryDelayMs = (attempt: number): number =>
  Math.min(MAX_EVENT_STREAM_RETRY_MS, 1_000 * 2 ** Math.max(0, attempt - 1));

const cancelSubscription = (subscription: ToriiCancelableSubscription | null): void => {
  try {
    subscription?.cancel();
  } catch {
    // Cancellation is best-effort during teardown and replacement.
  }
};

const openSubscription = (
  createSubscription: () => Promise<ToriiCancelableSubscription>,
  timeoutMs: number | undefined,
): Promise<ToriiCancelableSubscription> => {
  if (!timeoutMs || timeoutMs <= 0) return createSubscription();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error(`Event subscription attempt timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    createSubscription().then(
      (subscription) => {
        clearTimeout(timeout);
        if (settled) {
          cancelSubscription(subscription);
          return;
        }
        settled = true;
        resolve(subscription);
      },
      (error) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        reject(error);
      },
    );
  });
};

class RecoveringToriiEventSubscription implements ToriiCancelableSubscription {
  private activeSubscription: ToriiCancelableSubscription | null = null;
  private detachLifecycle = () => {};
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private leaseTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private streamLost = false;
  private disposed = false;

  constructor(private readonly input: RecoveringToriiEventSubscriptionInput) {}

  public async start(): Promise<ToriiCancelableSubscription> {
    this.activeSubscription = await openSubscription(this.input.createSubscription, this.input.attemptTimeoutMs);
    await this.establishReplayBaseline();
    this.armActiveSubscription();
    return this;
  }

  public cancel(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearScheduledWork();
    this.detachLifecycle();
    cancelSubscription(this.activeSubscription);
    this.activeSubscription = null;
  }

  private clearScheduledWork(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.leaseTimer) clearTimeout(this.leaseTimer);
    this.retryTimer = null;
    this.leaseTimer = null;
  }

  private markLost(reason: string): void {
    if (this.streamLost) return;
    this.streamLost = true;
    this.input.onLost(reason);
  }

  private scheduleRecovery(): void {
    if (this.disposed || this.retryTimer) return;
    this.retryAttempt += 1;
    const delayMs = (this.input.retryDelayMs ?? defaultRetryDelayMs)(this.retryAttempt);
    this.retryTimer = setTimeout(this.recover, delayMs);
  }

  private readonly recover = (): void => {
    void this.openReplacement();
  };

  private async openReplacement(): Promise<void> {
    this.retryTimer = null;
    const replayWatermark = this.input.captureReplayWatermark?.();
    try {
      const replacement = await openSubscription(this.input.createSubscription, this.input.attemptTimeoutMs);
      if (this.disposed) {
        cancelSubscription(replacement);
        return;
      }

      const replayedEventCount = await this.replayGap(replayWatermark, replacement);
      this.replaceActiveSubscription(replacement);
      this.input.onGapFillReplayed?.(replayedEventCount);
      this.markRestored();
      this.armActiveSubscription();
    } catch (error) {
      this.markLost(error instanceof Error ? error.message : String(error));
      this.scheduleRecovery();
    }
  }

  private async establishReplayBaseline(): Promise<void> {
    try {
      await this.input.establishReplayBaseline?.();
    } catch (error) {
      cancelSubscription(this.activeSubscription);
      this.activeSubscription = null;
      throw error;
    }
  }

  private async replayGap(watermark: unknown, replacement: ToriiCancelableSubscription): Promise<number> {
    try {
      return this.input.replaySince && watermark !== undefined ? await this.input.replaySince(watermark) : 0;
    } catch (error) {
      cancelSubscription(replacement);
      throw error;
    }
  }

  private replaceActiveSubscription(replacement: ToriiCancelableSubscription): void {
    const previous = this.activeSubscription;
    this.detachLifecycle();
    this.activeSubscription = replacement;
    cancelSubscription(previous);
  }

  private markRestored(): void {
    this.retryAttempt = 0;
    if (!this.streamLost) return;
    this.streamLost = false;
    this.input.onRestored();
  }

  private readonly handleLifecycleClose: ToriiStreamCloseHandler = ({ reason }) => {
    if (this.disposed) return;
    this.detachLifecycle();
    this.detachLifecycle = () => {};
    const failedSubscription = this.activeSubscription;
    this.activeSubscription = null;
    cancelSubscription(failedSubscription);
    this.markLost(reason);
    this.scheduleRecovery();
  };

  private armActiveSubscription(): void {
    if (!this.activeSubscription) return;
    this.detachLifecycle = observeToriiStreamLifecycle(this.activeSubscription, this.handleLifecycleClose);
    if (hasToriiStreamLifecycleSignals(this.activeSubscription)) return;

    // torii-wasm currently returns cancel-only handles. A replacement lease
    // is the only way to detect and recover a silently dead event route.
    this.leaseTimer = setTimeout(this.recover, this.input.leaseMs ?? EVENT_STREAM_LEASE_MS);
  }
}

export const createRecoveringToriiEventSubscription = (
  input: RecoveringToriiEventSubscriptionInput,
): Promise<ToriiCancelableSubscription> => new RecoveringToriiEventSubscription(input).start();
