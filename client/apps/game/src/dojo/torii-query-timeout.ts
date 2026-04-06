export class ToriiQueryTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`Timed out waiting for ${label} after ${timeoutMs}ms`);
    this.name = "ToriiQueryTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

async function withToriiQueryTimeout<T>(label: string, timeoutMs: number, work: Promise<T>): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return work;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new ToriiQueryTimeoutError(label, timeoutMs));
    }, timeoutMs);

    work.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export interface ToriiTimedQuery<T> {
  timed: Promise<T>;
  completion: Promise<void>;
}

export function createToriiTimedQuery<T>(label: string, timeoutMs: number, work: Promise<T>): ToriiTimedQuery<T> {
  return {
    timed: withToriiQueryTimeout(label, timeoutMs, work),
    completion: work.then(
      () => undefined,
      () => undefined,
    ),
  };
}
