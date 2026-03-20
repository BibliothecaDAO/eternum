import type { ArmyPath, PathDisplayState } from "../types/path";

export interface PathBatchPlan {
  displayState: PathDisplayState;
  entityIds: number[];
  segmentCount: number;
}

export function resolvePathBatches(paths: ArmyPath[], maxSegmentsPerBatch: number): PathBatchPlan[] {
  const normalizedMaxSegments = Math.max(1, Math.floor(maxSegmentsPerBatch));
  const batches: PathBatchPlan[] = [];

  paths.forEach((path) => {
    const previousBatch = batches[batches.length - 1];
    if (
      previousBatch &&
      previousBatch.displayState === path.displayState &&
      previousBatch.segmentCount + path.segmentCount <= normalizedMaxSegments
    ) {
      previousBatch.entityIds.push(path.entityId);
      previousBatch.segmentCount += path.segmentCount;
      return;
    }

    batches.push({
      displayState: path.displayState,
      entityIds: [path.entityId],
      segmentCount: path.segmentCount,
    });
  });

  return batches;
}
