export interface ShutdownGate {
  promise: Promise<void>;
  shutdown: () => void;
}

export function createShutdownGate(): ShutdownGate {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  let triggered = false;
  const shutdown = () => {
    if (triggered) return;
    triggered = true;
    resolve?.();
  };

  return { promise, shutdown };
}
