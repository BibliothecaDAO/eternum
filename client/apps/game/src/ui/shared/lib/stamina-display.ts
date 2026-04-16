const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));

interface StaminaDisplayInput {
  current: number;
  max: number;
  displayRatio?: number;
  projectedCurrent?: number;
}

interface StaminaDisplay {
  committedPercentage: number;
  displayPercentage: number;
  displayedCurrent: number;
}

export const resolveStaminaDisplay = ({
  current,
  max,
  displayRatio,
  projectedCurrent,
}: StaminaDisplayInput): StaminaDisplay => {
  const committedPercentage = max > 0 ? clampPercentage((current / max) * 100) : 0;

  const displayPercentage =
    displayRatio !== undefined && max > 0
      ? Math.max(committedPercentage, clampPercentage(displayRatio * 100))
      : committedPercentage;

  const displayedCurrent =
    projectedCurrent !== undefined && Number.isFinite(projectedCurrent)
      ? Math.round(projectedCurrent)
      : Math.round((displayPercentage / 100) * max);

  return {
    committedPercentage,
    displayPercentage,
    displayedCurrent,
  };
};
