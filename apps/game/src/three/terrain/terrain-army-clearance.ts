const TERRAIN_ARMY_CENTER_RADIUS = 0.34;
const TERRAIN_ARMY_ROUTE_HALF_WIDTH = 0.22;

/** Keep prop bases off travel routes and their standing footprint away from the army's destination. */
export function isTerrainArmySpaceClear(localX: number, localZ: number, standingFootprintRadius = 0): boolean {
  const distanceToRoute = Math.min(
    Math.abs(localZ),
    Math.abs((Math.sqrt(3) / 2) * localX - 0.5 * localZ),
    Math.abs((Math.sqrt(3) / 2) * localX + 0.5 * localZ),
  );
  return (
    Math.hypot(localX, localZ) >= TERRAIN_ARMY_CENTER_RADIUS + standingFootprintRadius &&
    distanceToRoute >= TERRAIN_ARMY_ROUTE_HALF_WIDTH
  );
}
