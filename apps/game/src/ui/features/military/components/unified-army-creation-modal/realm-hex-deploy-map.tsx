import { latticeToWorld } from "@/three/utils/hex-lattice";

import { requireBiomeColor, resolveBiomeTypeFromId } from "@/three/managers/biome-colors";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { Direction } from "@bibliothecadao/types";

/** One of the six tiles beside the structure, as spawnRing reads it, with the biome the map paints it in. */
export interface DeployTile {
  col: number;
  row: number;
  direction: Direction;
  open: boolean;
  explored: boolean;
  biome?: number;
}

interface RealmHexDeployMapProps {
  centerCol: number;
  centerRow: number;
  ring: readonly DeployTile[];
  selectedDirection: Direction | null;
  onSelect: (direction: Direction) => void;
}

const HEX_SIZE = 14;
// The game's hex lattice at this map's scale.
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

/** Room around the ring for the chosen tile's halo. */
const PAD = 3;

/**
 * The structure and the six tiles around it, the only ones an army can deploy onto, filling the frame. A free tile
 * carries a green mark and is picked by a click; a taken one carries a red mark and an unexplored one a "?", and
 * neither can be picked.
 */
export const RealmHexDeployMap = ({
  centerCol,
  centerRow,
  ring,
  selectedDirection,
  onSelect,
}: RealmHexDeployMapProps) => {
  const center = offsetToPixel(centerCol, centerRow);
  const tiles = ring.map((tile) => {
    const pixel = offsetToPixel(tile.col, tile.row);
    return { ...tile, pixel: { x: pixel.x - center.x, y: pixel.y - center.y } };
  });
  const halfWidth = Math.max(0, ...tiles.map(({ pixel }) => Math.abs(pixel.x))) + (HEX_SIZE * Math.sqrt(3)) / 2 + PAD;
  const halfHeight = Math.max(0, ...tiles.map(({ pixel }) => Math.abs(pixel.y))) + HEX_SIZE + PAD;

  return (
    <div className="flex-1 rounded-xl border border-hud-line p-1.5">
      {!ring.some((tile) => tile.open) ? (
        <HudNotice tone="bad" line="No adjacent tiles" />
      ) : (
        <>
          <svg
            viewBox={`${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
            className="mx-auto block h-auto w-full max-w-64"
            role="radiogroup"
            aria-label="Deploy tile"
          >
            <polygon points={hexCorners(0, 0)} className="fill-hud-chosen stroke-hud-gold" strokeWidth={1.6} />
            <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize={HEX_SIZE * 1.1}>
              🏰
            </text>
            {tiles.map((tile) => {
              const points = hexCorners(tile.pixel.x, tile.pixel.y);
              const isSelected = tile.open && tile.direction === selectedDirection;
              const fill = tile.explored ? getBiomeFill(tile.biome) : undefined;
              return (
                <g
                  key={tile.direction}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!tile.open}
                  aria-label={tile.open ? "free" : tile.explored ? "occupied" : "unexplored"}
                  className={cn("transition-opacity duration-150", tile.open ? "cursor-pointer" : "cursor-default")}
                  onClick={() => tile.open && onSelect(tile.direction)}
                >
                  <polygon
                    points={points}
                    fill={fill}
                    opacity={tile.open ? 1 : 0.55}
                    className={cn(
                      fill === undefined && "fill-hud-well",
                      isSelected ? "stroke-hud-accent" : tile.open ? "stroke-hud-line-strong" : "stroke-hud-divider",
                    )}
                    strokeWidth={isSelected ? 2.4 : tile.open ? 1.2 : 0.7}
                  />
                  {/* A pulsing halo in the age's accent over the chosen hex, so it reads against any biome. */}
                  {isSelected && (
                    <polygon points={points} fill="none" strokeWidth={3} className="animate-pulse stroke-hud-accent" />
                  )}
                  {tile.explored ? (
                    <circle
                      cx={tile.pixel.x}
                      cy={tile.pixel.y}
                      r={2.2}
                      className={cn(tile.open ? "fill-hud-good" : "fill-hud-bad", "stroke-hud-dark")}
                      strokeWidth={0.4}
                    />
                  ) : (
                    <text
                      x={tile.pixel.x}
                      y={tile.pixel.y + 1}
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
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-hud-good" />
              free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-hud-bad" />
              occupied
            </span>
            <span>? unexplored</span>
          </div>
        </>
      )}
    </div>
  );
};
