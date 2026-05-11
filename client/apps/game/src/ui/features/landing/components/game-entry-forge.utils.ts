const DEFAULT_HYPERSTRUCTURE_RESERVE_COUNT = 25;

export const resolveHyperstructureForgeBatchSize = (): number => DEFAULT_HYPERSTRUCTURE_RESERVE_COUNT;

export const resolveHyperstructureForgeCount = ({
  numHyperstructuresLeft,
  batchSize,
}: {
  numHyperstructuresLeft: number;
  batchSize: number;
}): number => {
  if (numHyperstructuresLeft <= 0 || batchSize <= 0) {
    return 0;
  }

  return Math.min(numHyperstructuresLeft, batchSize);
};
