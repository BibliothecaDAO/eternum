import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

/** Visual identity only. A surface spire changes this hex's art, never its gameplay biome. */
export function isEtherealTerrainCell(
  request: Pick<TerrainPageRequest, "surfacePresentation">,
  cell: Pick<TerrainCellInput, "surfacePresentation"> | undefined,
): boolean {
  return request.surfacePresentation === "ethereal" || cell?.surfacePresentation === "ethereal";
}
