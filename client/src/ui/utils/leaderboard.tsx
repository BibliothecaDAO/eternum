export const calculateLordsShare = (points: number, totalPoints: number, prizePoolAmount: number): number => {
  if (totalPoints === 0) return 0;

  const playerShare = (points / totalPoints) * prizePoolAmount;
  return Math.floor(playerShare);
};

export const calculatePlayerSharePercentage = (points: number, totalPoints: number): number => {
  if (totalPoints === 0) return 0;

  return Math.floor((points / totalPoints) * 100);
};
