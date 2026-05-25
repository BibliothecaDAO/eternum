const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));

interface StaminaDisplayInput {
  current: number;
  max: number;
}

interface StaminaDisplay {
  committedPercentage: number;
  displayPercentage: number;
  displayedCurrent: number;
}

export const resolveStaminaDisplay = ({ current, max }: StaminaDisplayInput): StaminaDisplay => {
  const percentage = max > 0 ? clampPercentage((current / max) * 100) : 0;
  const displayedCurrent = Math.round(current);

  return {
    committedPercentage: percentage,
    displayPercentage: percentage,
    displayedCurrent,
  };
};
