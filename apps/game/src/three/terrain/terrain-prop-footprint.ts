import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { getTerrainPropPlacementLayer } from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

/**
 * A prop must fit in visible, unoccupied ground, including the part beyond its owner hex; and a tree, taller than any
 * unit, never stands beside an occupied hex, so an army or a structure is seen whole (owner, on the phone test of the
 * new look).
 */
export function isTerrainPropFootprintClear(
  prop: Pick<TerrainPropInstance, "archetype" | "scale" | "ownerCol" | "ownerRow" | "worldX" | "worldZ">,
  isBlocked: (col: number, row: number) => boolean,
): boolean {
  if (isBlocked(prop.ownerCol, prop.ownerRow)) return false;
  const layer = getTerrainPropPlacementLayer(prop.archetype);
  const neighbours = terrainNeighborCoordinates(prop.ownerCol, prop.ownerRow);
  if (layer === "canopy") return !neighbours.some(({ col, row }) => isBlocked(col, row));
  const radius = (layer === "groundcover" ? 0.08 : 0.22) * prop.scale;
  const center = terrainHexToWorld(prop.ownerCol, prop.ownerRow);
  return neighbours.every(({ col, row }) => {
    if (!isBlocked(col, row)) return true;
    const neighbor = terrainHexToWorld(col, row);
    const dx = neighbor.x - center.x;
    const dz = neighbor.z - center.z;
    const spacing = Math.hypot(dx, dz);
    const distanceToEdge = spacing / 2 - ((prop.worldX - center.x) * dx + (prop.worldZ - center.z) * dz) / spacing;
    return distanceToEdge >= radius;
  });
}
