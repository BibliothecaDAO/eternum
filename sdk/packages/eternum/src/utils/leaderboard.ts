export const calculateGuildLordsPrize = (rank: number, prizePoolAmount: number): number => {
  const percentages = {
    1: 30,
    2: 20,
    3: 13,
    4: 9,
    5: 8,
    6: 7,
    7: 5,
    8: 4,
    9: 3,
    10: 1,
  };

  if (rank < 1 || rank > 10) return 0;

  const percentage = percentages[rank as keyof typeof percentages];
  return Math.floor((percentage / 100) * prizePoolAmount);
};
