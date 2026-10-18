import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { latticeToWorld } from "@/three/utils/hex-lattice";

import { requireBiomeColor, resolveBiomeTypeFromId } from "@/three/managers/biome-colors";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { Direction, getDirectionBetweenAdjacentHexes, getNeighborHexes } from "@bibliothecadao/types";
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
// The game's hex lattice at this map's scale; callers translate to recenter on the realm.
const offsetToPixel = (col: number, row: number) => {
  const { x, z } = latticeToWorld(col, row);
  return { x: x * HEX_SIZE, y: z * HEX_SIZE };
};

const hexCorners = (cx: number, cy: number) => {
  const corners: Array<[number, number]> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push([cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle)]);
  }
  return corners.map(([x, y]) => `${x},${y}`).join(" ");
};

/** A tile's biome colour, as the map paints it; none for an unexplored tile, which takes the sheet's well. */
const getBiomeFill = (biomeId?: number) => {
  const biomeType = resolveBiomeTypeFromId(biomeId);
  return biomeType ? requireBiomeColor(biomeType).getStyle() : undefined;
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
    <div className="flex-1 p-1.5 rounded-xl border border-hud-line">
      {isLoading ? (
        <div className="flex justify-center py-2">
          <SemanticIcon name="refresh" className="w-5 h-5 animate-spin" />
        </div>
      ) : noAdjacentAvailable ? (
        <HudNotice tone="bad" line="No adjacent tiles" />
      ) : (
        <>
          <svg viewBox={layout.viewBox} className="mx-auto block h-auto w-full max-w-64">
            {layout.positioned.map((entry) => {
              const tile = tiles.get(`${entry.col},${entry.row}`);
              const isCenter = entry.ringIndex === 0;
              const isAdjacent = entry.ringIndex === 1 && entry.direction !== null;
              const isAvailable = isAdjacent && availableDirections.includes(entry.direction as Direction);
              const isSelected = isAdjacent && entry.direction === selectedDirection;
              const isOccupied = (tile?.occupierId ?? 0n) !== 0n;
              const isUnexplored = !tile || (tile.biome ?? 0) === 0;
              const fill = isCenter ? undefined : getBiomeFill(tile?.biome);
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
                    className={cn(
                      isCenter ? "fill-hud-chosen" : fill === undefined && "fill-hud-well",
                      isSelected
                        ? "stroke-hud-accent"
                        : isCenter
                          ? "stroke-hud-gold"
                          : isAvailable
                            ? "stroke-hud-line-strong"
                            : "stroke-hud-divider",
                    )}
                    strokeWidth={isSelected ? 2.4 : isCenter ? 1.6 : isAvailable ? 1.2 : 0.7}
                  />
                  {/* A pulsing halo in the age's accent over the chosen hex, so it reads against any biome. */}
                  {isSelected && (
                    <polygon
                      points={entry.points}
                      fill="none"
                      strokeWidth={3}
                      className="animate-pulse stroke-hud-accent"
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
                      className="fill-hud-bad stroke-hud-dark"
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
                      className="fill-hud-cue"
                    >
                      ?
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-hud-label uppercase tracking-wider text-hud-cue">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-hud-gold" />
              free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-hud-bad" />
              occupied
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-hud-chosen" />? unexplored
            </span>
          </div>
        </>
      )}
    </div>
  );
};
