export interface WorldmapCriticalManagerCatchUpFailure {
  label: string;
  reason: unknown;
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
