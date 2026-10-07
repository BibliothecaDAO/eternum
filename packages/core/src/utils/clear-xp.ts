/**
 * The XP a clear pays, as contracts/l3/world-native/src/progression.cairo's clear_xp computes it from the site's
 * initial guard count: 2.5 times the square root of the guard in whole troops, rounded down, exactly
 * floor(isqrt(25 x guard) / 2).
 */
export const clearXp = (initialGuardTroops: number): number =>
  Math.floor(isqrt(Math.floor(initialGuardTroops) * 25) / 2);

/** The integer square root the contract takes: the largest whole number whose square does not pass `value`. */
const isqrt = (value: number): number => {
  let root = Math.floor(Math.sqrt(value));
  while (root * root > value) root -= 1;
  while ((root + 1) * (root + 1) <= value) root += 1;
  return root;
};
