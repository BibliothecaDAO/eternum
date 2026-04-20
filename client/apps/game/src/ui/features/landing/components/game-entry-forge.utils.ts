export const resolveHyperstructureForgeBatchSize = (chain: string): number => {
  return chain === "mainnet" ? 1 : 4;
};

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
