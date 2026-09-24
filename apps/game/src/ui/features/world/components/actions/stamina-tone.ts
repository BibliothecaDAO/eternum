/**
 * How an action's stamina cost reads against the army's stamina: covered, close or short. An army whose stamina this
 * client cannot see reads as unknown, never as short.
 */
export const staminaTone = (currentStamina: bigint | undefined, requiredStamina: number) => {
  if (currentStamina === undefined) return { color: "text-gold/60", isLow: false };
  const ratio = requiredStamina === 0 ? Number.POSITIVE_INFINITY : Number(currentStamina) / requiredStamina;
  const color = ratio >= 1 ? "text-order-brilliance" : ratio >= 0.5 ? "text-gold" : "text-order-giants";
  return { color, isLow: ratio < 1 };
};
