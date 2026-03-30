export interface ToriiCancelableSubscription {
  cancel: () => void;
}

interface SetupToriiSubscriptionsInput {
  createEntitySubscription: () => Promise<ToriiCancelableSubscription>;
  createEventSubscription: () => Promise<ToriiCancelableSubscription>;
  subscriptionSetupTimeoutMs?: number;
}

class ToriiSubscriptionSetupTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`Timed out waiting for ${label} after ${timeoutMs}ms`);
    this.name = "ToriiSubscriptionSetupTimeoutError";
  }
}

async function resolveToriiSubscriptionWithTimeout(
  label: string,
  createSubscription: () => Promise<ToriiCancelableSubscription>,
  timeoutMs?: number,
): Promise<ToriiCancelableSubscription> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return createSubscription();
  }

  return new Promise<ToriiCancelableSubscription>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      settled = true;
      reject(new ToriiSubscriptionSetupTimeoutError(label, timeoutMs));
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
}: SetupToriiSubscriptionsInput): Promise<ToriiCancelableSubscription> {
  let entitySubscription: ToriiCancelableSubscription | null = null;

  try {
    entitySubscription = await resolveToriiSubscriptionWithTimeout(
      "entity subscription",
      createEntitySubscription,
      subscriptionSetupTimeoutMs,
    );
    const eventSubscription = await resolveToriiSubscriptionWithTimeout(
      "event subscription",
      createEventSubscription,
      subscriptionSetupTimeoutMs,
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
