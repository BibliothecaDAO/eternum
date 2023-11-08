// note: placeholder
export const calculateStealSuccess = (raiders: number, defence: number) => {
  if (!defence) return 1;
  const success = raiders / (raiders + defence);
  return success;
};

// note: placeholder
export const calculateCombatSuccess = (attackers: number, defenders: number | undefined) => {
  if (!defenders) return 1;
  const success = attackers / (attackers + defenders);
  return success;
};

// note: placeholder
export const calculateDamages = (attackers: number, defenders: number | undefined) => {
  if (!defenders) return 0;
  const success = calculateCombatSuccess(attackers, defenders);
  const damages = success * attackers;
  return damages;
};

export const getResourceCost = (quantity: number): { resourceId: number; amount: number }[] => {
  return [
    {
      resourceId: 6,
      amount: 10000 * quantity,
    },
    { resourceId: 254, amount: 1000000 * quantity },
    { resourceId: 255, amount: 1000000 * quantity },
  ];
};
