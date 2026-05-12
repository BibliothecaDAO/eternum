const calculateTotalHyperstructureReservations = (maxRingCount: number, twoPlayerMode: boolean): number =>
  twoPlayerMode ? maxRingCount + 1 : 1 + 6 * ((maxRingCount * (maxRingCount + 1)) / 2);

const calculateReservedHyperstructureCount = ({
  maxRingCount,
  currentRingCount,
  currentPoint,
  currentSide,
  twoPlayerMode,
}: {
  maxRingCount: number;
  currentRingCount: number;
  currentPoint: number;
  currentSide: number;
  twoPlayerMode: boolean;
}): number => {
  const totalReservations = calculateTotalHyperstructureReservations(maxRingCount, twoPlayerMode);
  if (totalReservations <= 0) {
    return 0;
  }

  if (twoPlayerMode) {
    return Math.min(totalReservations, Math.max(0, currentRingCount));
  }

  const isInitialCursor = currentRingCount === 0 && currentSide === 5 && currentPoint === 1;
  if (isInitialCursor) {
    return 0;
  }

  if (currentRingCount > maxRingCount) {
    return totalReservations;
  }

  const completedPreviousRings = currentRingCount === 0 ? 0 : 1 + 3 * (currentRingCount - 1) * currentRingCount;
  const reservedInCurrentRing =
    currentRingCount === 0 ? 0 : currentSide * currentRingCount + Math.max(0, currentPoint - 1);

  return Math.min(totalReservations, Math.max(0, completedPreviousRings + reservedInCurrentRing));
};

export const resolveFinalHyperstructureMaxRingCount = (
  registrationCountMax: number,
  twoPlayerMode: boolean,
): number => {
  if (registrationCountMax <= 0) {
    return 0;
  }

  if (twoPlayerMode) {
    return 2;
  }

  let maxRingCount = 0;
  while (registrationCountMax >= 6 * maxRingCount * maxRingCount + 1) {
    maxRingCount += 1;
  }

  return maxRingCount;
};

export const calculateHyperstructureReservationsLeft = ({
  registrationCountMax,
  currentRingCount,
  currentPoint,
  currentSide,
  twoPlayerMode,
}: {
  registrationCountMax: number;
  currentRingCount: number;
  currentPoint: number;
  currentSide: number;
  twoPlayerMode: boolean;
}): number => {
  if (registrationCountMax <= 0) {
    return 0;
  }

  const finalMaxRingCount = resolveFinalHyperstructureMaxRingCount(registrationCountMax, twoPlayerMode);
  const totalReservations = calculateTotalHyperstructureReservations(finalMaxRingCount, twoPlayerMode);
  const reservedCount = calculateReservedHyperstructureCount({
    maxRingCount: finalMaxRingCount,
    currentRingCount,
    currentPoint,
    currentSide,
    twoPlayerMode,
  });

  return Math.max(0, totalReservations - reservedCount);
};
