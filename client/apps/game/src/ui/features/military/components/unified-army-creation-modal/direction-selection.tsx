import { Direction } from "@bibliothecadao/types";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

interface DirectionSelectionProps {
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  isLoading: boolean;
  onSelect: (direction: Direction) => void;
}

// Hexagon path generator for pointy-top hexagons (rotated 90deg)
const getHexPath = (cx: number, cy: number, size: number) => {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 2; // Add 90 degree rotation
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    points.push([x, y]);
  }
  return `M ${points.map(p => p.join(',')).join(' L ')} Z`;
};

// Map directions to hex positions around center
const getHexPositions = (size: number) => {
  const spacing = size * 1.75;
  return {
    [Direction.EAST]: { x: spacing, y: 0 },
    [Direction.SOUTH_EAST]: { x: spacing / 2, y: spacing * 0.866 },
    [Direction.SOUTH_WEST]: { x: -spacing / 2, y: spacing * 0.866 },
    [Direction.WEST]: { x: -spacing, y: 0 },
    [Direction.NORTH_WEST]: { x: -spacing / 2, y: -spacing * 0.866 },
    [Direction.NORTH_EAST]: { x: spacing / 2, y: -spacing * 0.866 },
  };
};

export const DirectionSelection = ({
  availableDirections,
  selectedDirection,
  isLoading,
  onSelect,
}: DirectionSelectionProps) => {
  const hexSize = 28;
  const positions = getHexPositions(hexSize);
  const centerX = 100;
  const centerY = 100;
  const viewBoxSize = 200;

  return (
    <div className="flex-1 p-1.5 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      {isLoading ? (
        <div className="flex justify-center py-1">
          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : availableDirections.length > 0 ? (
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="w-full h-auto max-w-[200px] mx-auto"
        >
          {/* Center hexagon (castle) */}
          <g>
            <path
              d={getHexPath(centerX, centerY, hexSize)}
              className="fill-brown/20 stroke-gold/40"
              strokeWidth="2"
            />
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="32"
            >
              🏰
            </text>
          </g>

          {/* Surrounding direction hexagons */}
          {Object.entries(positions).map(([dir, pos]) => {
            const direction = Number(dir) as Direction;
            const isAvailable = availableDirections.includes(direction);
            const isSelected = selectedDirection === direction;

            return (
              <g
                key={direction}
                className={clsx(
                  "transition-all duration-150",
                  isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-30"
                )}
                onClick={() => isAvailable && onSelect(direction)}
              >
                <path
                  d={getHexPath(centerX + pos.x, centerY + pos.y, hexSize)}
                  className={clsx(
                    "transition-all duration-150",
                    isSelected
                      ? "fill-gold/20 stroke-gold"
                      : isAvailable
                        ? "fill-brown/10 stroke-gold/40 hover:fill-gold/10 hover:stroke-gold/60"
                        : "fill-brown/5 stroke-brown/30"
                  )}
                  strokeWidth={isSelected ? "3" : "2"}
                />
                {isSelected && (
                  <circle
                    cx={centerX + pos.x}
                    cy={centerY + pos.y}
                    r="4"
                    className="fill-gold"
                  />
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="text-center p-2 bg-danger/10 border-l-2 border-danger rounded">
          <div className="p-1 rounded-full bg-danger/20 w-fit mx-auto mb-1">
            <AlertTriangle className="w-4 h-4 text-danger" />
          </div>
          <p className="text-danger font-bold text-xxs">No adjacent tiles</p>
        </div>
      )}
    </div>
  );
};
