export interface ToriiHeartbeatSubscription {
  cancel: () => void;
}

export interface ToriiHeartbeatLifecycleInput {
  subscribe: () => Promise<ToriiHeartbeatSubscription | null | undefined>;
}

export interface ToriiHeartbeatLifecycle {
  start: () => Promise<void>;
  reopen: () => Promise<void>;
  reopenWith: (subscribe: ToriiHeartbeatLifecycleInput["subscribe"]) => Promise<void>;
  dispose: () => void;
}

export function createToriiHeartbeatLifecycle(input: ToriiHeartbeatLifecycleInput): ToriiHeartbeatLifecycle {
  let current: ToriiHeartbeatSubscription | null = null;
  let disposed = false;
  let openGeneration = 0;

  const openWith = async (subscribe: ToriiHeartbeatLifecycleInput["subscribe"]) => {
    const generation = (openGeneration += 1);
    const next = await subscribe();
    if (disposed || generation !== openGeneration) {
      next?.cancel();
      return;
    }
    current?.cancel();
    current = next ?? null;
  };

  return {
    start: () => openWith(input.subscribe),
    reopen: () => openWith(input.subscribe),
    reopenWith: openWith,
    dispose: () => {
      disposed = true;
      current?.cancel();
      current = null;
    },
  };
}
