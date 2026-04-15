const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));

interface StaminaDisplayInput {
  current: number;
  max: number;
  displayRatio?: number;
  projectedCurrent?: number;
}

interface StaminaDisplay {
  committedPercentage: number;
  projectedPercentage: number;
  displayedCurrent: number;
}

export const resolveStaminaDisplay = ({
  current,
  max,
  displayRatio,
  projectedCurrent,
}: StaminaDisplayInput): StaminaDisplay => {
  const committedPercentage = max > 0 ? clampPercentage((current / max) * 100) : 0;
  const projectedPercentageFromRatio =
    max > 0 ? Math.max(committedPercentage, clampPercentage((displayRatio ?? committedPercentage / 100) * 100)) : 0;
  const displayedCurrent =
    projectedCurrent !== undefined && Number.isFinite(projectedCurrent)
      ? Math.round(projectedCurrent)
      : Math.round((projectedPercentageFromRatio / 100) * max);
  const projectedPercentage =
    max > 0 ? Math.max(committedPercentage, clampPercentage((displayedCurrent / max) * 100)) : 0;

  return {
    committedPercentage,
    projectedPercentage,
    displayedCurrent,
  };
};
