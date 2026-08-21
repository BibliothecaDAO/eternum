import { runWithFrameWorkOwner } from "../frame-work-owner";

export interface WorldmapCriticalManagerCatchUpFailure {
  label: string;
  reason: unknown;
}

interface WorldmapCriticalManagerCatchUpTask {
  label: string;
  run: () => Promise<void>;
  recover: () => void;
}

interface RunWorldmapCriticalManagerCatchUpInput {
  context: {
    chunkKey: string;
    transitionToken: number;
    triggerReason: string;
  };
  log?: (message: string) => void;
  managers: WorldmapCriticalManagerCatchUpTask[];
  timeoutMs: number;
  now?: () => number;
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

interface FailedWorldmapCriticalManagerCatchUp {
  failure: WorldmapCriticalManagerCatchUpFailure;
  recover: () => void;
}

type CriticalManagerCatchUpResult = { status: "converged" } | { status: "failed" | "timed_out"; reason: unknown };

interface HandleWorldmapCriticalManagerCatchUpFailuresInput {
  chunkKey: string;
  failures: WorldmapCriticalManagerCatchUpFailure[];
  onManagerFailure: (failure: WorldmapCriticalManagerCatchUpFailure) => void;
  scheduleRecovery: (chunkKey: string, failingManagers: string[]) => void;
}

export function handleWorldmapCriticalManagerCatchUpFailures(
  input: HandleWorldmapCriticalManagerCatchUpFailuresInput,
): number {
  if (input.failures.length === 0) {
    return 0;
  }

  input.failures.forEach((failure) => {
    input.onManagerFailure(failure);
  });

  input.scheduleRecovery(
    input.chunkKey,
    input.failures.map((failure) => failure.label),
  );

  return input.failures.length;
}

export async function runWorldmapCriticalManagerCatchUp(
  input: RunWorldmapCriticalManagerCatchUpInput,
): Promise<WorldmapCriticalManagerCatchUpFailure[]> {
  const failedManagers = await Promise.all(
    input.managers.map((manager) => settleCriticalManagerCatchUp(manager, input)),
  );
  const recoverableFailures = failedManagers.filter(
    (failure): failure is FailedWorldmapCriticalManagerCatchUp => failure !== null,
  );

  recoverableFailures.forEach((failure) => {
    failure.recover();
  });

  return recoverableFailures.map((failure) => failure.failure);
}

async function settleCriticalManagerCatchUp(
  manager: WorldmapCriticalManagerCatchUpTask,
  input: RunWorldmapCriticalManagerCatchUpInput,
): Promise<FailedWorldmapCriticalManagerCatchUp | null> {
  const now = input.now ?? (() => performance.now());
  const startedAt = now();
  const result = await settleCriticalManagerPromise(manager, input);
  const durationMs = now() - startedAt;
  // Console reporting is caller-injected (DEV-gated at the call site); there is
  // no production fallback — perf lines never leak into shipped builds.
  const log = input.log;
  if (log) {
    log(
      `[WorldmapPerf] critical ${manager.label} manager catch-up ` +
        `chunk=${input.context.chunkKey} transition=${input.context.transitionToken} ` +
        `trigger=${input.context.triggerReason} ${result.status} after ${Math.round(durationMs)}ms of sliced wall time`,
    );
  }
  if (result.status === "converged") {
    return null;
  }

  return {
    failure: {
      label: manager.label,
      reason: result.reason,
    },
    recover: manager.recover,
  };
}

async function settleCriticalManagerPromise(
  manager: WorldmapCriticalManagerCatchUpTask,
  input: RunWorldmapCriticalManagerCatchUpInput,
): Promise<CriticalManagerCatchUpResult> {
  const setTimeoutFn = input.setTimeoutFn ?? ((callback, timeoutMs) => setTimeout(callback, timeoutMs));
  const clearTimeoutFn = input.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const settled = runCriticalManagerCatchUpTask(manager).then(
    (): CriticalManagerCatchUpResult => ({ status: "converged" }),
    (reason): CriticalManagerCatchUpResult => ({ status: "failed", reason }),
  );
  settled.catch(() => undefined);
  if (input.timeoutMs <= 0) {
    return await settled;
  }

  const timeout = new Promise<CriticalManagerCatchUpResult>((resolve) => {
    timeoutHandle = setTimeoutFn(
      () =>
        resolve({
          status: "timed_out",
          reason: new Error(`Critical ${manager.label} manager catch-up timed out after ${input.timeoutMs}ms`),
        }),
      input.timeoutMs,
    );
  });

  try {
    return await Promise.race([settled, timeout]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeoutFn(timeoutHandle);
    }
  }
}

function runCriticalManagerCatchUpTask(manager: WorldmapCriticalManagerCatchUpTask): Promise<void> {
  try {
    return runWithFrameWorkOwner(`catchup:${manager.label}`, manager.run);
  } catch (error) {
    return Promise.reject(error);
  }
}
