import { Hourglass } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Chip } from "@/ui/features/frontier/frontier-chips";
import { formatAmount, formatTimeLeft } from "@/ui/features/frontier/frontier-format";
import { PersonGlyph } from "@/ui/features/frontier/glyphs";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** A game's seats as a bar of segments, lit as players take them. */
export const SeatBar = ({ filled, total }: { filled: number; total: number }) => (
  <span role="meter" aria-label={`Seats ${filled} of ${total}`} className="flex h-4 items-stretch gap-[2px]">
    {Array.from({ length: total }, (_, seat) => (
      <span key={seat} className={cn("w-[3px] rounded-sm", seat < filled ? "bg-[#f3d08a]" : "bg-[#46351c]")} />
    ))}
  </span>
);

/** Time left to a start or a close, as the hourglass and "0:42" or "12d"; unknown is "—". */
export const TimeLeftChip = ({ seconds }: { seconds: number | undefined }) => (
  <Chip small label="Time left" icon={<Hourglass />} value={seconds === undefined ? "—" : formatTimeLeft(seconds)} />
);

export const PlayersChip = ({ count }: { count: number }) => (
  <Chip small label="Players" icon={<PersonGlyph />} value={formatAmount(count)} />
);

/** The one verb of a screen or card, on the primary token: large on a hero, card scale on a card. */
export const PrimaryLink = ({ to, children, small = false }: { to: string; children: ReactNode; small?: boolean }) => (
  <Link
    to={to}
    className={cn(
      "frontier-primary pointer-events-auto flex items-center justify-center px-6",
      small && "!h-11 !rounded-xl !px-5 !text-[17px]",
    )}
  >
    {children}
  </Link>
);
