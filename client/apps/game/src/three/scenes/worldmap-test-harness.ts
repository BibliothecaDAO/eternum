export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export interface ControlledAsyncCall<TArgs extends unknown[], TResult> {
  calls: TArgs[];
  fn: (...args: TArgs) => Promise<TResult>;
  resolveNext: (value?: TResult) => void;
  rejectNext: (reason?: unknown) => void;
  pendingCount: () => number;
}

export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export async function flushMicrotasks(turns: number = 1): Promise<void> {
  const totalTurns = Math.max(1, Math.floor(turns));
  for (let i = 0; i < totalTurns; i += 1) {
    await Promise.resolve();
  }
}

export function createControlledAsyncCall<TArgs extends unknown[], TResult>(): ControlledAsyncCall<TArgs, TResult> {
  const calls: TArgs[] = [];
  const pending: Array<Deferred<TResult>> = [];

  return {
    calls,
    fn: (...args: TArgs) => {
      calls.push(args);
      const deferred = createDeferred<TResult>();
      pending.push(deferred);
      return deferred.promise;
    },
    resolveNext: (value?: TResult) => {
      const deferred = pending.shift();
      if (!deferred) {
        throw new Error("No pending controlled async calls to resolve");
      }
      deferred.resolve(value as TResult);
    },
    rejectNext: (reason?: unknown) => {
      const deferred = pending.shift();
      if (!deferred) {
        throw new Error("No pending controlled async calls to reject");
      }
      deferred.reject(reason);
    },
    pendingCount: () => pending.length,
  };
}

