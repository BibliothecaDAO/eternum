export const getDisplayProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) return 0;

  const rounded = Math.round(progress);
  if (rounded >= 100) return 99;
  if (rounded <= 0) return 0;

  return rounded;
};

export const getNextStatementIndex = (current: number, total: number): number => {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return (current + 1) % total;
};
