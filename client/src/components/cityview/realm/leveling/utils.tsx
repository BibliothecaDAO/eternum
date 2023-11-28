const COST_MULTIPLIER = 1.25;

export const getLevelingCost = (newLevel: number): { resourceId: number; amount: number }[] => {
  const costMultiplier = COST_MULTIPLIER ** Math.floor((newLevel - 1) / 4);

  const rem = newLevel % 4;

  const baseAmounts =
    rem === 0
      ? [16, 4264, 17, 3659, 18, 2922, 19, 2448, 20, 1448, 21, 974, 22, 605]
      : rem === 1
      ? [254, 3780000, 255, 1260000]
      : rem === 2
      ? [1, 132000, 2, 103731, 3, 100889, 4, 69566, 5, 58327, 6, 45825, 7, 31033]
      : rem === 3
      ? [8, 25189, 9, 24057, 10, 15635, 11, 7896, 12, 6501, 13, 6291, 14, 6291, 15, 4527]
      : [];

  const costResources = [];
  for (let i = 0; i < baseAmounts.length; i = i + 2) {
    costResources.push({
      resourceId: baseAmounts[i],
      amount: Math.floor(baseAmounts[i + 1] * costMultiplier),
    });
  }
  return costResources;
};
