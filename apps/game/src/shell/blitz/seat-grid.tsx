import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { BLITZ_SEATS } from "../blitz-slot";
import { BLITZ_WORDS } from "../words";
import type { seatsOf } from "./lobby";

/**
 * The lobby's 24 sockets (spec 06): a taken seat shows its player's portrait, the player's own on the peach ring,
 * an open one stays empty. Six by four on a phone, twelve by two on desktop.
 */
export const SeatGrid = ({ seats }: { seats: ReturnType<typeof seatsOf> }) => (
  <ul
    aria-label={`${BLITZ_WORDS.seats} ${seats.length}/${BLITZ_SEATS}`}
    className="grid grid-cols-6 gap-2.5 lg:grid-cols-12"
  >
    {Array.from({ length: BLITZ_SEATS }, (_, index) => (
      <li key={index} className="aspect-square">
        {seats[index] ? (
          <Socket account={seats[index].account} own={seats[index].own} />
        ) : (
          <span className="block size-full rounded-full border-2 border-dashed border-kit-line" />
        )}
      </li>
    ))}
  </ul>
);

const Socket = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  return (
    <img
      src={playerPortraitUrl(account, profile.portrait)}
      alt=""
      className={cn(
        "size-full rounded-full border-2 object-cover",
        own ? "border-[3px] border-kit-peach" : "border-kit-line2",
      )}
    />
  );
};
