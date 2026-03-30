export interface ToriiCancelableSubscription {
  cancel: () => void;
}

export interface ToriiSubscriptionSetupTimeoutInfo {
  label: string;
  timeoutMs: number;
}

interface SetupToriiSubscriptionsInput {
  createEntitySubscription: () => Promise<ToriiCancelableSubscription>;
  createEventSubscription: () => Promise<ToriiCancelableSubscription>;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}

class ToriiSubscriptionSetupTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor({ label, timeoutMs }: ToriiSubscriptionSetupTimeoutInfo) {
    super(`Timed out waiting for ${label} after ${timeoutMs}ms`);
    this.name = "ToriiSubscriptionSetupTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

function createToriiSubscriptionSetupTimeoutInfo(label: string, timeoutMs: number): ToriiSubscriptionSetupTimeoutInfo {
  return { label, timeoutMs };
}

async function resolveToriiSubscriptionWithTimeout(
  label: string,
  createSubscription: () => Promise<ToriiCancelableSubscription>,
  timeoutMs?: number,
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void,
): Promise<ToriiCancelableSubscription> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return createSubscription();
  }

  return new Promise<ToriiCancelableSubscription>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      settled = true;
      const timeoutInfo = createToriiSubscriptionSetupTimeoutInfo(label, timeoutMs);
      onSubscriptionSetupTimeout?.(timeoutInfo);
      reject(new ToriiSubscriptionSetupTimeoutError(timeoutInfo));
    }, timeoutMs);

    createSubscription().then(
      (subscription) => {
        clearTimeout(timeoutId);
        if (settled) {
          subscription.cancel();
          return;
        }
        settled = true;
        resolve(subscription);
      },
      (error) => {
        clearTimeout(timeoutId);
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      },
    );
  });
}

export async function setupToriiSubscriptions({
  createEntitySubscription,
  createEventSubscription,
  subscriptionSetupTimeoutMs,
  onSubscriptionSetupTimeout,
}: SetupToriiSubscriptionsInput): Promise<ToriiCancelableSubscription> {
  let entitySubscription: ToriiCancelableSubscription | null = null;

  try {
    entitySubscription = await resolveToriiSubscriptionWithTimeout(
      "entity subscription",
      createEntitySubscription,
      subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout,
    );
    const eventSubscription = await resolveToriiSubscriptionWithTimeout(
      "event subscription",
      createEventSubscription,
      subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout,
    );

    return {
      cancel: () => {
        entitySubscription?.cancel();
        eventSubscription.cancel();
      },
    };
  } catch (error) {
    entitySubscription?.cancel();
    throw error;
  }
}
