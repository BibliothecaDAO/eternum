import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

/** Gold, silver and bronze: a medal's face and its bright rim, first to third. */
const FACE = ["#e8bf5e", "#c9ced8", "#c8875a"] as const;
const RIM = ["#fff0b8", "#f2f4f8", "#efb88e"] as const;

/**
 * A place's mark, the same in the game and the app (the owner, 30 October 2026: "yeah medal simple"): for the first three
 * places a gold, silver or bronze disc with its place, the first with the crown over it; below them, `below` (the rank
 * as the board writes it).
 */
export const PlaceMedal = ({ place, size = 22, below }: { place: number; size?: number; below: ReactNode }) =>
  place >= 1 && place <= 3 ? (
    <span
      role="img"
      aria-label={`#${place}`}
      data-medal={place}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {place === 1 && (
        <span aria-hidden className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[55%]">
          <Icon name="crown" size={Math.round(size * 0.6)} />
        </span>
      )}
      <span
        aria-hidden
        className="flex size-full items-center justify-center rounded-full border-2 font-bold leading-none tabular-nums text-[#1b1622]"
        style={{ background: FACE[place - 1], borderColor: RIM[place - 1], fontSize: Math.round(size * 0.48) }}
      >
        {place}
      </span>
    </span>
  ) : (
    below
  );
