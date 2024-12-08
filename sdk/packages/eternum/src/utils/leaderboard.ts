export const calculateGuildLordsPrize = (rank: number, prizePoolAmount: number): number => {
  const percentages = {
    1: 30,
    2: 20,
    3: 13,
    4: 9,
    5: 7,
    6: 5,
    7: 4,
    8: 3,
    9: 2,
    10: 1,
  };

  if (rank < 1 || rank > 10) return 0;

  const percentage = percentages[rank as keyof typeof percentages];
  return Math.floor((percentage / 100) * prizePoolAmount);
};
