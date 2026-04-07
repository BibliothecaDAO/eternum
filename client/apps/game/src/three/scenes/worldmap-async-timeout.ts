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
    return {
      status: "resolved",
      value: await promise,
    };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race<WorldmapAsyncStageResult<T>>([
      promise.then((value) => ({
        status: "resolved",
        value,
      })),
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
