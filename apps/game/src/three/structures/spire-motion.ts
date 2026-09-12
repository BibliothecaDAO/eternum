const ORBIT_SECONDS = 8;
const REST_SECONDS = 4;

/** A complete turn with a slow departure, acceleration and a smooth arrival before resting. */
export function spireOrbitAngle(seconds: number): number {
  const cycle = ORBIT_SECONDS + REST_SECONDS;
  const elapsed = ((seconds % cycle) + cycle) % cycle;
  if (elapsed >= ORBIT_SECONDS) return Math.PI * 2;
  const progress = elapsed / ORBIT_SECONDS;
  const turn = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  return turn * Math.PI * 2;
}
