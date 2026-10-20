import type { CSSProperties } from "react";

import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { cn } from "@/ui/design-system/atoms/lib/utils";

const SIZES = { 28: "size-7", 80: "size-20", 96: "size-24", fill: "size-full" } as const;
type KnownSize = keyof typeof SIZES;

const WEIGHTS = { 1.5: "border-[1.5px]", 2: "border-2", 3: "border-[3px]" } as const;

/** Peach for the player's own or the current place; the line for anyone else. */
const RINGS = { lit: "border-kit-peach", line: "border-kit-line2" } as const;

const isKnownSize = (size: number | string): size is KnownSize => size in SIZES;

/**
 * A player's portrait, round on its ring: their chosen one, else the stock portrait their account resolves to; while
 * their profile is not known yet (`pending`), the ring alone, never a stock face that is not theirs. A size off the list
 * (a tab's icon) is set in pixels; none leaves the box to the host (a grid's square cell).
 */
export const Portrait = ({
  account = null,
  portrait = null,
  size,
  ring = "line",
  weight,
  pending = false,
  className,
}: {
  account?: string | bigint | null;
  portrait?: string | null;
  /** The player's profile is still being asked for: draw the ring and nothing in it. */
  pending?: boolean;
  size?: KnownSize | number;
  ring?: keyof typeof RINGS;
  /** The ring's width; none where the host draws the ring and clips the round itself (a choice's button). */
  weight?: keyof typeof WEIGHTS;
  className?: string;
}) => {
  const known = size !== undefined && isKnownSize(size);
  const style: CSSProperties | undefined =
    typeof size === "number" && !known ? { width: size, height: size } : undefined;
  if (pending)
    return (
      <span
        aria-hidden
        style={style}
        className={cn(
          "block bg-kit-plate2",
          known && SIZES[size],
          weight !== undefined && ["rounded-full", WEIGHTS[weight], RINGS[ring]],
          className,
        )}
      />
    );
  return (
    <img
      src={playerPortraitUrl(account, portrait)}
      alt=""
      style={style}
      className={cn(
        "object-cover",
        known && SIZES[size],
        weight !== undefined && ["rounded-full", WEIGHTS[weight], RINGS[ring]],
        className,
      )}
    />
  );
};

/** A seat known taken whose player is not named: the portrait's ring around a dash. */
const EmptyPortrait = () => (
  <span className="flex size-full items-center justify-center rounded-full border-2 border-kit-line2 bg-kit-plate2 text-kit-muted">
    —
  </span>
);

Portrait.Empty = EmptyPortrait;
