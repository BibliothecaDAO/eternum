import { BUILDINGS_CENTER, getNeighborHexes } from "@bibliothecadao/types";
type BuildSpot = { col: number; row: number };
const buildablePositionsCache = new Map<number, BuildSpot[]>();
const toBuildSpotKey = ({ col, row }: BuildSpot) => `${col},${row}`;
export const generateBuildablePositions = (radius: number) => {
  const cached = buildablePositionsCache.get(radius);
  if (cached) return cached;

  const positions: BuildSpot[] = [];
  const seen = new Set<string>();

  const addPosition = (col: number, row: number) => {
    const key = toBuildSpotKey({ col, row });
    if (seen.has(key)) return;
    positions.push({ col, row });
    seen.add(key);
  };

  const start = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
  addPosition(start.col, start.row);

  let currentLayer = [start];
  for (let i = 0; i < radius; i += 1) {
    const nextLayer: BuildSpot[] = [];
    currentLayer.forEach((position) => {
      getNeighborHexes(position.col, position.row).forEach((neighbor) => {
        const key = toBuildSpotKey(neighbor);
        if (seen.has(key)) return;

        addPosition(neighbor.col, neighbor.row);
        nextLayer.push(neighbor);
      });
    });
    currentLayer = nextLayer;
  }

  buildablePositionsCache.set(radius, positions);
  return positions;
};
