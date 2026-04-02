export type WorldmapBarrierStatus = "ready" | "timed_out" | "aborted";

export interface WorldmapBarrierResult {
  status: WorldmapBarrierStatus;
  label: string;
  durationMs: number;
}

interface WaitWorldmapAuthoritativeBarrierInput {
  label: string;
  promise: Promise<void>;
  timeoutMs: number;
  isSwitchedOff: () => boolean;
  isCurrentTransition?: () => boolean;
  pollIntervalMs?: number;
  nowMs?: () => number;
}

export function waitForWorldmapAuthoritativeBarrier(
  input: WaitWorldmapAuthoritativeBarrierInput,
): Promise<WorldmapBarrierResult> {
  const nowMs = input.nowMs ?? (() => performance.now());
  const startedAt = nowMs();
  const timeoutMs = Math.max(0, input.timeoutMs);
  const pollIntervalMs = Math.max(1, input.pollIntervalMs ?? 16);

  return new Promise<WorldmapBarrierResult>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pollId !== null) {
        clearTimeout(pollId);
        pollId = null;
      }
    };

    const finish = (status: WorldmapBarrierStatus) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      resolve({
        status,
        label: input.label,
        durationMs: nowMs() - startedAt,
      });
    };

    const shouldAbort = () =>
      input.isSwitchedOff() || (input.isCurrentTransition ? !input.isCurrentTransition() : false);

    const pollAbortState = () => {
      if (settled) {
        return;
      }

      if (shouldAbort()) {
        finish("aborted");
        return;
      }

      pollId = setTimeout(pollAbortState, pollIntervalMs);
    };

    if (shouldAbort()) {
      finish("aborted");
      return;
    }

    timeoutId = setTimeout(() => {
      finish("timed_out");
    }, timeoutMs);
    pollId = setTimeout(pollAbortState, pollIntervalMs);

    input.promise.then(
      () => finish("ready"),
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimers();
        reject(error);
      },
    );
  });
}
