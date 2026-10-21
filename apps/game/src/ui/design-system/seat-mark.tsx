import type { CSSProperties } from "react";

import type { SeatSide } from "@/tokens";

/**
 * A player's seat to a watching viewer: their initial on their seat's colour, as their map tokens carry it. Nothing for
 * nobody's, or while the viewer plays.
 */
export const SeatMark = ({ side, name }: { side: SeatSide | null; name: string }) => {
  const letter = name.trim().charAt(0).toUpperCase();
  if (!side || side.seat === null || !letter) return null;
  return (
    <span className="ui-seat" data-ink={side.ink} style={{ "--seat": side.colour } as CSSProperties} aria-hidden>
      {letter}
    </span>
  );
};
