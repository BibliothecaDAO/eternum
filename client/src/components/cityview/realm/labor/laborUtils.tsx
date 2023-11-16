export const formatSecondsInHoursMinutes = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h:${minutes}m`;
};

export const formatSecondsLeftInDaysHours = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const secondsLeft = seconds % 86400;
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  return `${days} days ${hours}h ${minutes}m`;
};

export const calculateLevelMultiplier = (level: number) => {
  let levelMultiplier = 1;
  if (level === 1) {
    levelMultiplier = 1.25;
  } else if (level === 2) {
    levelMultiplier = 1.5;
  } else if (level === 3) {
    levelMultiplier = 2;
  }

  return levelMultiplier;
};

export const calculateProductivity = (
  resources_per_cycle: number,
  multiplier: number,
  cycle_length: number,
  level: number,
): number => {
  let productivity = (resources_per_cycle * multiplier) / cycle_length;
  // in hours
  return productivity * calculateLevelMultiplier(level) * 3600;
};

// calculates how much you will have when you click on harvest
export const calculateNextHarvest = (
  balance: number,
  lastHarvestTimestamp: number,
  multiplier: number,
  cycleLengthInSeconds: number,
  productionPerCycle: number,
  nextBlockTimeInSeconds: number,
  level: number,
): number => {
  if (nextBlockTimeInSeconds <= lastHarvestTimestamp) return 0;

  const harvestSeconds = Math.min(balance, nextBlockTimeInSeconds) - lastHarvestTimestamp;
  const nextHarvestUnits = Math.floor(harvestSeconds / cycleLengthInSeconds);

  return nextHarvestUnits * productionPerCycle * multiplier * calculateLevelMultiplier(level);
};
