import { BUILDINGS_CENTER, getHexDistance, type HexPosition } from "@bibliothecadao/types";

const CASTLE: HexPosition = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };

/**
 * The plot the board marks for the building Next up asks for: the open plot nearest the castle, so the first build
 * stands beside it. Ties go to the lower row, then the lower column, so the mark never moves while nothing changes.
 * None when no plot is open.
 */
export const askedPlot = (openPlots: readonly HexPosition[]): HexPosition | null =>
  openPlots.reduce<HexPosition | null>((best, plot) => (best === null || isNearer(plot, best) ? plot : best), null);

const isNearer = (plot: HexPosition, than: HexPosition): boolean => {
  const gap = getHexDistance(CASTLE, plot) - getHexDistance(CASTLE, than);
  if (gap !== 0) return gap < 0;
  return plot.row !== than.row ? plot.row < than.row : plot.col < than.col;
};
