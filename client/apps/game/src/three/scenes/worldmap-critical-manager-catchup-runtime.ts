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
  managers: WorldmapCriticalManagerCatchUpTask[];
  timeoutMs: number;
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

interface FailedWorldmapCriticalManagerCatchUp {
  failure: WorldmapCriticalManagerCatchUpFailure;
  recover: () => void;
}

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
  const result = await settleCriticalManagerPromise(manager, input);
  if (result === null) {
    return null;
  }

  return {
    failure: {
      label: manager.label,
      reason: result,
    },
    recover: manager.recover,
  };
}

async function settleCriticalManagerPromise(
  manager: WorldmapCriticalManagerCatchUpTask,
  input: RunWorldmapCriticalManagerCatchUpInput,
): Promise<unknown | null> {
  const setTimeoutFn = input.setTimeoutFn ?? ((callback, timeoutMs) => setTimeout(callback, timeoutMs));
  const clearTimeoutFn = input.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const settled = runCriticalManagerCatchUpTask(manager).then(
    () => null,
    (error) => error,
  );
  settled.catch(() => undefined);
  if (input.timeoutMs <= 0) {
    return await settled;
  }

  const timeout = new Promise<Error>((resolve) => {
    timeoutHandle = setTimeoutFn(
      () => resolve(new Error(`Critical ${manager.label} manager catch-up timed out after ${input.timeoutMs}ms`)),
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
    return manager.run();
  } catch (error) {
    return Promise.reject(error);
  }
}
