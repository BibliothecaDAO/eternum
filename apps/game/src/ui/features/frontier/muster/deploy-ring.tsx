import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Direction } from "@bibliothecadao/types";

import { CastleGlyph } from "../glyphs";

/** Where each ring tile sits around the realm, by the direction the army steps out in. */
const ANGLE: Record<Direction, number> = {
  [Direction.EAST]: 0,
  [Direction.NORTH_EAST]: -60,
  [Direction.NORTH_WEST]: -120,
  [Direction.WEST]: 180,
  [Direction.SOUTH_WEST]: 120,
  [Direction.SOUTH_EAST]: 60,
};

const NAME: Record<Direction, string> = {
  [Direction.EAST]: "east",
  [Direction.NORTH_EAST]: "north-east",
  [Direction.NORTH_WEST]: "north-west",
  [Direction.WEST]: "west",
  [Direction.SOUTH_WEST]: "south-west",
  [Direction.SOUTH_EAST]: "south-east",
};

const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/**
 * The six tiles around the realm as a small ring, the realm at its heart: the player taps the tile the army deploys
 * onto. Occupied or unexplored tiles are dimmed and cannot be picked; the chosen one is lit.
 */
export const DeployRing = ({
  ring,
  chosen,
  onChoose,
}: {
  ring: readonly { direction: Direction; open: boolean }[];
  chosen: Direction | null;
  onChoose: (direction: Direction) => void;
}) => (
  <div role="radiogroup" aria-label="Deploy tile" className="relative mx-auto size-36 shrink-0">
    <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
      <CastleGlyph className="size-8" />
    </span>
    {ring.map((tile) => {
      const angle = (ANGLE[tile.direction] * Math.PI) / 180;
      const selected = tile.direction === chosen;
      return (
        <button
          key={tile.direction}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={`Deploy ${NAME[tile.direction]}`}
          disabled={!tile.open}
          onClick={() => onChoose(tile.direction)}
          style={{
            left: `${50 + 35 * Math.cos(angle)}%`,
            top: `${50 + 35 * Math.sin(angle)}%`,
            clipPath: HEX,
          }}
          className={cn(
            "absolute size-11 -translate-x-1/2 -translate-y-1/2",
            selected
              ? "bg-[linear-gradient(180deg,#ffc24a,#e39001)]"
              : tile.open
                ? "bg-[#5a7a34] hover:bg-[#6f9442]"
                : "bg-[#2a2013] opacity-60",
          )}
        />
      );
    })}
  </div>
);
