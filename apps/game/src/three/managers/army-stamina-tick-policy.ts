export const resolveArmyStaminaTickRefresh = (input: { currentTick: number; previousTick: number }) => {
  if (!Number.isFinite(input.currentTick)) {
    return {
      shouldRecompute: false,
      nextTrackedTick: input.previousTick,
    };
  }

  if (!Number.isFinite(input.previousTick)) {
    return {
      shouldRecompute: true,
      nextTrackedTick: input.currentTick,
    };
  }

  return {
    shouldRecompute: input.currentTick !== input.previousTick,
    nextTrackedTick: input.currentTick,
  };
};
