const DEFAULT_HYPERSTRUCTURE_RESERVE_BATCH_SIZE = 25;

export const resolveHyperstructureReservationBatchSize = (): number => DEFAULT_HYPERSTRUCTURE_RESERVE_BATCH_SIZE;

export const resolveHyperstructureReservationCount = ({
  remainingReservations,
  batchSize,
}: {
  remainingReservations: number | null;
  batchSize: number;
}): number => {
  if (batchSize <= 0) {
    return 0;
  }

  if (remainingReservations == null || remainingReservations <= 0) {
    return batchSize;
  }

  return Math.min(remainingReservations, batchSize);
};
