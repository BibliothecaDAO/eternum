/**
 * Determines the maximum layer based on the number of realms
 * @param realmCount Number of realms
 * @returns Maximum layer
 */
export function getMaxLayer(realmCount: number): number {
  if (realmCount <= 1500) return 26; // 2105 capacity
  if (realmCount <= 2500) return 32; // 3167 capacity
  if (realmCount <= 3500) return 37; // 4217 capacity
  if (realmCount <= 4500) return 41; // 5165 capacity
  if (realmCount <= 5500) return 45; // 6209 capacity
  if (realmCount <= 6500) return 49; // 7349 capacity
  return 52; // 8267 capacity
}
