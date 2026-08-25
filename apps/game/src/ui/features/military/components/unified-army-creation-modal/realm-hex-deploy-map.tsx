import { BIOME_COLORS } from "@/three/managers/biome-colors";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  BiomeIdToType,
  BiomeType,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
} from "@bibliothecadao/types";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useMemo } from "react";

interface RealmHexDeployMapProps {
  centerCol: number;
  centerRow: number;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  isLoading: boolean;
  onSelect: (direction: Direction) => void;
  /** Hex ring radius around the realm (default 3). */
  radius?: number;
}

const HEX_SIZE = 14;
const SQRT3 = Math.sqrt(3);

const hexWidth = SQRT3 * HEX_SIZE;
const hexHeight = HEX_SIZE * 2;
const vertDist = hexHeight * 0.75;
const horizDist = hexWidth;

// Absolute-coord hex layout — odd rows get a half-width shimmy so neighbors
// from `getNeighborHexes` line up. Callers translate to recenter on the realm.
const offsetToPixel = (col: number, row: number) => {
  const rowParity = ((row % 2) + 2) % 2;
  const rowOffset = rowParity * (horizDist / 2);
  const x = col * horizDist - rowOffset;
  const y = row * vertDist;
  return { x, y };
};

const hexCorners = (cx: number, cy: number) => {
  const corners: Array<[number, number]> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push([cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle)]);
  }
  return corners.map(([x, y]) => `${x},${y}`).join(" ");
};

const UNEXPLORED_FILL = "#1f2933";
const REALM_FILL = "rgba(223, 170, 84, 0.35)";

const getBiomeFill = (biomeId?: number) => {
  if (biomeId === undefined || biomeId === 0) return UNEXPLORED_FILL;
  const biomeType = BiomeIdToType[biomeId];
  if (biomeType === BiomeType.Taiga) return "#ffffff";
  const color = BIOME_COLORS[biomeType as keyof typeof BIOME_COLORS];
  return color?.getStyle?.() ?? UNEXPLORED_FILL;
};

type HexEntry = {
  col: number;
  row: number;
  relCol: number;
  relRow: number;
  ringIndex: number;
  direction: Direction | null;
};

/**
 * BFS expand `radius` rings out from (centerCol, centerRow), tagging the
 * 6 immediate neighbors with their Direction so the picker knows which click
 * → which contract direction.
 */
const buildHexRings = (centerCol: number, centerRow: number, radius: number): HexEntry[] => {
  const seen = new Set<string>();
  const out: HexEntry[] = [];

  const key = (c: number, r: number) => `${c},${r}`;
  const push = (col: number, row: number, ringIndex: number) => {
    const k = key(col, row);
    if (seen.has(k)) return;
    seen.add(k);
    let direction: Direction | null = null;
    if (ringIndex === 1) {
      direction = getDirectionBetweenAdjacentHexes({ col: centerCol, row: centerRow }, { col, row });
    }
    out.push({
      col,
      row,
      relCol: col - centerCol,
      relRow: row - centerRow,
      ringIndex,
      direction,
    });
  };

  push(centerCol, centerRow, 0);
  let frontier: Array<{ col: number; row: number }> = [{ col: centerCol, row: centerRow }];

  for (let r = 1; r <= radius; r += 1) {
    const nextFrontier: Array<{ col: number; row: number }> = [];
    frontier.forEach(({ col, row }) => {
      getNeighborHexes(col, row).forEach((neighbor) => {
        if (!seen.has(key(neighbor.col, neighbor.row))) {
          push(neighbor.col, neighbor.row, r);
          nextFrontier.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    frontier = nextFrontier;
  }

  return out;
};

/**
 * Live 3-ring hex preview centered on the realm. Adjacent hexes are clickable
 * direction picks; outer rings show actual biome / unexplored / occupier state
 * so the player can read terrain before committing to a placement.
 */
export const RealmHexDeployMap = ({
  centerCol,
  centerRow,
  availableDirections,
  selectedDirection,
  isLoading,
  onSelect,
  radius = 3,
}: RealmHexDeployMapProps) => {
  const hexes = useMemo(() => buildHexRings(centerCol, centerRow, radius), [centerCol, centerRow, radius]);

  const projectedTiles = useWorldSpatialTiles(hexes);
  const tiles = useMemo(
    () =>
      new Map(
        projectedTiles.map((tile) => [
          `${tile.hexCoords.col},${tile.hexCoords.row}`,
          { biome: tile.biome, occupierId: BigInt(tile.occupierId) },
        ]),
      ),
    [projectedTiles],
  );

  const layout = useMemo(() => {
    const centerPixel = offsetToPixel(centerCol, centerRow);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const positioned = hexes.map((entry) => {
      const abs = offsetToPixel(entry.col, entry.row);
      const pixel = { x: abs.x - centerPixel.x, y: abs.y - centerPixel.y };
      const points = hexCorners(pixel.x, pixel.y);
      minX = Math.min(minX, pixel.x - HEX_SIZE);
      maxX = Math.max(maxX, pixel.x + HEX_SIZE);
      minY = Math.min(minY, pixel.y - HEX_SIZE);
      maxY = Math.max(maxY, pixel.y + HEX_SIZE);
      return { ...entry, pixel, points };
    });

    const pad = 4;
    return {
      positioned,
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    };
  }, [hexes, centerCol, centerRow]);

  const noAdjacentAvailable = !isLoading && availableDirections.length === 0;

  return (
    <div className="flex-1 p-1.5 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      {isLoading ? (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : noAdjacentAvailable ? (
        <div className="text-center p-2 bg-danger/10 border-l-2 border-danger rounded">
          <div className="p-1 rounded-full bg-danger/20 w-fit mx-auto mb-1">
            <AlertTriangle className="w-4 h-4 text-danger" />
          </div>
          <p className="text-danger font-bold text-xxs">No adjacent tiles</p>
        </div>
      ) : (
        <>
          <svg viewBox={layout.viewBox} className="mx-auto block h-auto w-full max-w-[260px]">
            {layout.positioned.map((entry) => {
              const tile = tiles.get(`${entry.col},${entry.row}`);
              const isCenter = entry.ringIndex === 0;
              const isAdjacent = entry.ringIndex === 1 && entry.direction !== null;
              const isAvailable = isAdjacent && availableDirections.includes(entry.direction as Direction);
              const isSelected = isAdjacent && entry.direction === selectedDirection;
              const isOccupied = (tile?.occupierId ?? 0n) !== 0n;
              const isUnexplored = !tile || (tile.biome ?? 0) === 0;
              const fill = isCenter ? REALM_FILL : getBiomeFill(tile?.biome);
              const opacity = isCenter ? 1 : isAdjacent ? (isAvailable ? 1 : 0.55) : 0.85;

              return (
                <g
                  key={`${entry.col}-${entry.row}`}
                  className={cn(
                    "transition-opacity duration-150",
                    isAvailable && "cursor-pointer",
                    !isAvailable && !isCenter && "cursor-default",
                  )}
                  onClick={() => {
                    if (!isAvailable || entry.direction === null) return;
                    onSelect(entry.direction);
                  }}
                >
                  <polygon
                    points={entry.points}
                    fill={fill}
                    opacity={opacity}
                    stroke={
                      isSelected
                        ? "rgb(34, 211, 238)"
                        : isCenter
                          ? "rgba(223, 170, 84, 0.85)"
                          : isAvailable
                            ? "rgba(223, 170, 84, 0.55)"
                            : "rgba(255, 255, 255, 0.08)"
                    }
                    strokeWidth={isSelected ? 2.4 : isCenter ? 1.6 : isAvailable ? 1.2 : 0.7}
                  />
                  {/* Pulsing cyan halo on top of the selected hex so it pops
                      against any biome tone (especially beige). */}
                  {isSelected && (
                    <polygon
                      points={entry.points}
                      fill="none"
                      stroke="rgb(34, 211, 238)"
                      strokeWidth={3}
                      className="animate-pulse"
                      style={{ filter: "drop-shadow(0 0 4px rgb(34, 211, 238))" }}
                    />
                  )}
                  {isCenter && (
                    <text
                      x={entry.pixel.x}
                      y={entry.pixel.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={HEX_SIZE * 1.1}
                    >
                      🏰
                    </text>
                  )}
                  {isOccupied && !isCenter && (
                    <circle
                      cx={entry.pixel.x}
                      cy={entry.pixel.y}
                      r={2.2}
                      fill="rgb(244, 114, 114)"
                      stroke="black"
                      strokeWidth={0.4}
                    />
                  )}
                  {isUnexplored && !isCenter && (
                    <text
                      x={entry.pixel.x}
                      y={entry.pixel.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={HEX_SIZE * 0.7}
                      fill="rgba(255, 255, 255, 0.45)"
                    >
                      ?
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9px] uppercase tracking-wider text-gold/55">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold/70" />
              free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/80" />
              occupied
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold/30" />? unexplored
            </span>
          </div>
        </>
      )}
    </div>
  );
};
