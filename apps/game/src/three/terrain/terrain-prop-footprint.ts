import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { getTerrainPropPlacementLayer, getTerrainPropSpacingRadius } from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

interface PropGround {
  isBlocked: (col: number, row: number) => boolean;
  isOccupied: (col: number, row: number) => boolean;
}

export function isTerrainPropFootprintClear(
  prop: Pick<TerrainPropInstance, "archetype" | "scale" | "ownerCol" | "ownerRow" | "worldX" | "worldZ">,
  { isBlocked, isOccupied }: PropGround,
): boolean {
  if (isBlocked(prop.ownerCol, prop.ownerRow)) return false;
  const layer = getTerrainPropPlacementLayer(prop.archetype);
  const neighbours = terrainNeighborCoordinates(prop.ownerCol, prop.ownerRow);
  if (layer === "canopy" && neighbours.some(({ col, row }) => isOccupied(col, row))) return false;
  const radius = getTerrainPropSpacingRadius(prop.archetype) * prop.scale;
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
