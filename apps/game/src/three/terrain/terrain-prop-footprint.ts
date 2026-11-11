import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { getTerrainPropCanopyExclusionRadius, getTerrainPropPlacementLayer } from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

/** The ground round a prop: hexes it may not reach into, and hexes where something stands (an army, a structure). */
interface PropGround {
  isBlocked: (col: number, row: number) => boolean;
  isOccupied: (col: number, row: number) => boolean;
}

/**
 * A prop must fit in visible, unoccupied ground, including the part beyond its owner hex; and a tree, taller than any
 * unit, never stands beside a hex where something stands, so an army or a structure is seen whole (owner, on the phone
 * test of the new look). Unexplored ground or the page's edge beside it does not keep a tree away.
 */
export function isTerrainPropFootprintClear(
  prop: Pick<TerrainPropInstance, "archetype" | "scale" | "ownerCol" | "ownerRow" | "worldX" | "worldZ">,
  { isBlocked, isOccupied }: PropGround,
): boolean {
  if (isBlocked(prop.ownerCol, prop.ownerRow)) return false;
  const layer = getTerrainPropPlacementLayer(prop.archetype);
  const neighbours = terrainNeighborCoordinates(prop.ownerCol, prop.ownerRow);
  if (layer === "canopy" && neighbours.some(({ col, row }) => isOccupied(col, row))) return false;
  const radius =
    (layer === "canopy"
      ? getTerrainPropCanopyExclusionRadius(prop.archetype) * 1.5
      : layer === "groundcover"
        ? 0.08
        : 0.22) * prop.scale;
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
