interface WorldmapAsyncStageTimeoutInfo<TLabel extends string = string> {
  label: TLabel;
  timeoutMs: number;
}

export type WorldmapAsyncStageResult<T> =
  | {
      status: "resolved";
      value: T;
    }
  | {
      status: "timed_out";
    }
  | {
      status: "rejected";
      error: unknown;
    };

interface SettleWorldmapAsyncStageInput<T, TLabel extends string> {
  label: TLabel;
  promise: Promise<T>;
  timeoutMs?: number;
  onTimeout?: (info: WorldmapAsyncStageTimeoutInfo<TLabel>) => void;
}

export async function settleWorldmapAsyncStage<T, TLabel extends string>({
  label,
  promise,
  timeoutMs,
  onTimeout,
}: SettleWorldmapAsyncStageInput<T, TLabel>): Promise<WorldmapAsyncStageResult<T>> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    try {
      return {
        status: "resolved",
        value: await promise,
      };
    } catch (error) {
      console.warn(`[WorldmapAsync] Phase "${label}" rejected without timeout`, error);
      return {
        status: "rejected",
        error,
      };
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race<WorldmapAsyncStageResult<T>>([
      promise.then(
        (value) => ({
          status: "resolved" as const,
          value,
        }),
        (error) => {
          console.warn(`[WorldmapAsync] Phase "${label}" rejected`, error);
          return {
            status: "rejected" as const,
            error,
          };
        },
      ),
      new Promise<WorldmapAsyncStageResult<T>>((resolve) => {
        timeoutId = setTimeout(() => {
          onTimeout?.({
            label,
            timeoutMs,
          });
          resolve({
            status: "timed_out",
          });
        }, timeoutMs);
      }),
    ]);

    return result;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
