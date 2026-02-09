export const resolveMovementPath = <T>(start: T, target: T, workerPath: T[] | null | undefined): T[] => {
  if (!workerPath || workerPath.length < 2) {
    return [start, target];
  }

  return workerPath;
};
