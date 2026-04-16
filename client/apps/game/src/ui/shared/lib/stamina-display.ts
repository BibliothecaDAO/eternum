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

export const resolveStaminaDisplay = ({ current, max }: StaminaDisplayInput): StaminaDisplay => {
  const committedPercentage = max > 0 ? clampPercentage((current / max) * 100) : 0;
  const displayedCurrent = Math.round(current);

  return {
    committedPercentage,
    displayPercentage: committedPercentage,
    displayedCurrent,
  };
};
