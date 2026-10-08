import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { BLITZ_SEATS } from "../blitz-slot";
import { BLITZ_WORDS } from "../words";
import type { Seat } from "./lobby";

/**
 * The lobby's 24 sockets (spec 06): a taken seat shows its player's portrait, the player's own on the peach ring,
 * an open one stays empty. While the roster's realms are prepared, each socket ticks once its player's realm is ready,
 * and shows a dash while that is unknown. Six by four on a phone, twelve by two on desktop.
 */
export const SeatGrid = ({ seats, preparing }: { seats: readonly Seat[]; preparing: boolean }) => (
  <ul
    aria-label={`${BLITZ_WORDS.seats} ${seats.length}/${BLITZ_SEATS}`}
    className="grid grid-cols-6 gap-2.5 lg:grid-cols-12"
  >
    {Array.from({ length: BLITZ_SEATS }, (_, index) => (
      <li key={index} className="relative aspect-square">
        {seats[index] ? (
          <TakenSocket seat={seats[index]} preparing={preparing} />
        ) : (
          <span className="block size-full rounded-full border-2 border-dashed border-kit-line" />
        )}
      </li>
    ))}
  </ul>
);

const TakenSocket = ({ seat, preparing }: { seat: Seat; preparing: boolean }) => (
  <>
    {seat.account === null ? <UnnamedPortrait /> : <Portrait account={seat.account} own={seat.own} />}
    {preparing && <PreparedMark prepared={seat.prepared} />}
  </>
);

const Portrait = ({ account, own }: { account: string; own: boolean }) => {
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

/** A seat known taken whose player Herald does not name. */
const UnnamedPortrait = () => (
  <span className="flex size-full items-center justify-center rounded-full border-2 border-kit-line2 bg-kit-plate2 text-kit-muted">
    —
  </span>
);

/** The socket's corner while the roster prepares: a tick once the realm is ready, a dash while unknown. */
const PreparedMark = ({ prepared }: { prepared: boolean | undefined }) => {
  if (prepared === false) return null;
  return (
    <span
      aria-hidden
      className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border border-kit-line2 bg-kit-ground text-[12px] text-kit-muted"
    >
      {prepared ? <KitIcon code="Ok" size={16} /> : "—"}
    </span>
  );
};
