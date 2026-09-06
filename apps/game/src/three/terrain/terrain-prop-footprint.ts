import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { getTerrainPropCanopyExclusionRadius, getTerrainPropPlacementLayer } from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

/** A prop must fit in visible, unoccupied ground, including the part beyond its owner hex. */
export function isTerrainPropFootprintClear(
  prop: Pick<TerrainPropInstance, "archetype" | "scale" | "ownerCol" | "ownerRow" | "worldX" | "worldZ">,
  isBlocked: (col: number, row: number) => boolean,
): boolean {
  if (isBlocked(prop.ownerCol, prop.ownerRow)) return false;
  const layer = getTerrainPropPlacementLayer(prop.archetype);
  const radius =
    (layer === "canopy"
      ? getTerrainPropCanopyExclusionRadius(prop.archetype) * 1.5
      : layer === "groundcover"
        ? 0.08
        : 0.22) * prop.scale;
  const center = terrainHexToWorld(prop.ownerCol, prop.ownerRow);
  return terrainNeighborCoordinates(prop.ownerCol, prop.ownerRow).every(({ col, row }) => {
    if (!isBlocked(col, row)) return true;
    const neighbor = terrainHexToWorld(col, row);
    const dx = neighbor.x - center.x;
    const dz = neighbor.z - center.z;
    const spacing = Math.hypot(dx, dz);
    const distanceToEdge = spacing / 2 - ((prop.worldX - center.x) * dx + (prop.worldZ - center.z) * dz) / spacing;
    return distanceToEdge >= radius;
  });
}
