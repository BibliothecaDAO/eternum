export const calculatePlayerSharePercentage = (points: number, totalPoints: number): number => {
  if (totalPoints === 0) return 0;

  return Math.floor((points / totalPoints) * 100);
};
