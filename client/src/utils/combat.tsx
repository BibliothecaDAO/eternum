// note: placeholder
// export const calculateStealSuccess = (raiders: number, defence: number) => {
//   if (!defence) return 1;
//   const success = raiders / (raiders + defence);
//   return success;
// };

// note: placeholder
export const calculateSuccess = (
  attacker: { attack: number; health: number },
  defender: { defence: number; health: number } | undefined,
) => {
  if (!defender) return 1;
  const attacker_weight = attacker.attack * attacker.health;
  const total_weight = attacker_weight + defender.defence * defender.health;
  const success = attacker_weight / total_weight;
  return success;
};

// note: placeholder
export const calculateDamages = (attackers: number, defenders: number | undefined) => {
  return 1;
};

export const getResourceCost = (quantity: number): { resourceId: number; amount: number }[] => {
  return [
    { resourceId: 254, amount: 1512000 * quantity },
    { resourceId: 255, amount: 504000 * quantity },
  ];
};
