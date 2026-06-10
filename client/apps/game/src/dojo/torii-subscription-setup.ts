export interface ToriiCancelableSubscription {
  cancel: () => void;
}

export interface ToriiManagedSubscriptions extends ToriiCancelableSubscription {
  entitySubscription: ToriiCancelableSubscription;
  eventSubscription: ToriiCancelableSubscription;
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

interface UpdateToriiSubscriptionsInput {
  updateEntitySubscription: () => Promise<void>;
  updateEventSubscription: () => Promise<void>;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}

interface ManagedToriiSubscriptionSetup {
  cancelResolved: () => void;
  promise: Promise<ToriiCancelableSubscription>;
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

async function resolveToriiOperationWithTimeout<T>(
  label: string,
  runOperation: () => Promise<T>,
  timeoutMs?: number,
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void,
): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return runOperation();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      settled = true;
      const timeoutInfo = createToriiSubscriptionSetupTimeoutInfo(label, timeoutMs);
      onSubscriptionSetupTimeout?.(timeoutInfo);
      reject(new ToriiSubscriptionSetupTimeoutError(timeoutInfo));
    }, timeoutMs);

    runOperation().then(
      (result) => {
        clearTimeout(timeoutId);
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
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

function createManagedToriiSubscriptionSetup(
  label: string,
  createSubscription: () => Promise<ToriiCancelableSubscription>,
  timeoutMs?: number,
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void,
): ManagedToriiSubscriptionSetup {
  let resolvedSubscription: ToriiCancelableSubscription | null = null;
  let cancelOnResolve = false;

  const promise = resolveToriiSubscriptionWithTimeout(
    label,
    createSubscription,
    timeoutMs,
    onSubscriptionSetupTimeout,
  ).then((subscription) => {
    if (cancelOnResolve) {
      subscription.cancel();
      return subscription;
    }

    resolvedSubscription = subscription;
    return subscription;
  });

  return {
    cancelResolved: () => {
      if (resolvedSubscription) {
        resolvedSubscription.cancel();
        return;
      }

      cancelOnResolve = true;
    },
    promise,
  };
}

export async function setupToriiSubscriptions({
  createEntitySubscription,
  createEventSubscription,
  subscriptionSetupTimeoutMs,
  onSubscriptionSetupTimeout,
}: SetupToriiSubscriptionsInput): Promise<ToriiManagedSubscriptions> {
  const entitySetup = createManagedToriiSubscriptionSetup(
    "entity subscription",
    createEntitySubscription,
    subscriptionSetupTimeoutMs,
    onSubscriptionSetupTimeout,
  );
  const eventSetup = createManagedToriiSubscriptionSetup(
    "event subscription",
    createEventSubscription,
    subscriptionSetupTimeoutMs,
    onSubscriptionSetupTimeout,
  );

  try {
    const [entitySubscription, eventSubscription] = await Promise.all([entitySetup.promise, eventSetup.promise]);

    return {
      entitySubscription,
      eventSubscription,
      cancel: () => {
        entitySubscription.cancel();
        eventSubscription.cancel();
      },
    };
  } catch (error) {
    entitySetup.cancelResolved();
    eventSetup.cancelResolved();
    throw error;
  }
}

export async function updateToriiSubscriptions({
  updateEntitySubscription,
  updateEventSubscription,
  subscriptionSetupTimeoutMs,
  onSubscriptionSetupTimeout,
}: UpdateToriiSubscriptionsInput): Promise<void> {
  await Promise.all([
    resolveToriiOperationWithTimeout(
      "entity subscription update",
      updateEntitySubscription,
      subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout,
    ),
    resolveToriiOperationWithTimeout(
      "event subscription update",
      updateEventSubscription,
      subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout,
    ),
  ]);
}
