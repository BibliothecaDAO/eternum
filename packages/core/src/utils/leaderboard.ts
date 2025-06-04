export const calculateGuildLordsPrize = (
  rank: number,
  lordsPrizePoolAmount: number,
  strkPrizePoolAmount: number,
): { lords: number; strk: number } => {
  const percentages = {
    1: 30,
    2: 18,
    3: 12,
    4: 9,
    5: 7,
    6: 6,
    7: 5,
    8: 5,
    9: 4,
    10: 4,
  };

  if (rank < 1 || rank > 10) return { lords: 0, strk: 0 };

  const percentage = percentages[rank as keyof typeof percentages];
  return {
    lords: Math.floor((percentage / 100) * lordsPrizePoolAmount),
    strk: Math.floor((percentage / 100) * strkPrizePoolAmount),
  };
};

export const calculatePlayerSharePercentage = (points: number, totalPoints: number): number => {
  if (totalPoints === 0) return 0;

  return Math.floor((points / totalPoints) * 100);
};
