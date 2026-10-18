import { BLITZ_WORDS } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { usePlayerProfile } from "@/hooks/use-player-profile";

import { AppFigure } from "@/ui/design-system/kit/app-elements";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { Portrait } from "@/ui/design-system/kit/portrait";

import { RatingFigure } from "../rating-mark";
import { useRatings } from "../ratings";
import { BLITZ_SEATS, type PlaytestSlot } from "../blitz-slot";
import { useSlotRegistered } from "./entry";
import type { Seat } from "./lobby";

/**
 * The lobby's sockets (spec 06), one per seat of the game's roster (24 for a Blitz, six a row): a taken seat shows its
 * player's portrait, the player's own on the peach ring, an open one stays empty. While the roster's realms are
 * prepared, each socket ticks once its player's realm is ready, and shows a dash while that is unknown.
 */
export const SeatGrid = ({
  seats,
  total,
  preparing,
}: {
  seats: readonly Seat[];
  total: number;
  preparing: boolean;
}) => (
  <ul aria-label={`${BLITZ_WORDS.seats} ${seats.length}/${total}`} className="grid grid-cols-6 gap-2.5">
    {Array.from({ length: total }, (_, index) => (
      <li key={index} className="relative aspect-square">
        {seats[index] ? (
          <TakenSocket seat={seats[index]} preparing={preparing} />
        ) : (
          <span className="block size-full rounded-full border-2 border-dashed border-app-line" />
        )}
      </li>
    ))}
  </ul>
);

const TakenSocket = ({ seat, preparing }: { seat: Seat; preparing: boolean }) => (
  <>
    {seat.account === null ? <Portrait.Empty /> : <SeatPortrait account={seat.account} own={seat.own} />}
    {preparing && <PreparedMark prepared={seat.prepared} />}
  </>
);

/** A taken seat's player, the player's own on the heavier peach ring. */
const SeatPortrait = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  return (
    <Portrait
      account={account}
      portrait={profile.portrait}
      size="fill"
      weight={own ? 3 : 2}
      ring={own ? "lit" : "line"}
    />
  );
};

/** The socket's corner while the roster prepares: a tick once the realm is ready, a dash while unknown. */
const PreparedMark = ({ prepared }: { prepared: boolean | undefined }) => {
  if (prepared === false) return null;
  return (
    <span
      aria-hidden
      className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border border-app-line-strong bg-app-ground text-sm text-app-muted"
    >
      {prepared ? <SemanticIcon name="check" size={16} /> : "—"}
    </span>
  );
};

/**
 * The desktop lobby's roster: the same 24 seats, large, each with its player's name and Blitz rating under the
 * portrait. A rating belongs to the wallet that plays: the one the roster froze for the seat (a dash where none
 * answers, or for a seat Herald does not name).
 */
export const RosterGrid = ({
  seats,
  total,
  preparing,
}: {
  seats: readonly Seat[];
  total: number;
  preparing: boolean;
}) => {
  const ratings = useRatings(seats.flatMap((seat) => (seat.wallet ? [seat.wallet] : [])));
  return (
    <ul aria-label={`${BLITZ_WORDS.seats} ${seats.length}/${total}`} className="grid grid-cols-6 gap-x-6 gap-y-5">
      {Array.from({ length: total }, (_, index) => {
        const seat = seats[index];
        const answer = seat?.wallet ? ratings.data?.ratings[seat.wallet] : undefined;
        return (
          <li key={index} className="flex flex-col items-center gap-1.5">
            <span className="relative block aspect-square w-full max-w-24">
              {seat ? (
                <TakenSocket seat={seat} preparing={preparing} />
              ) : (
                <span className="block size-full rounded-full border-2 border-dashed border-app-line" />
              )}
            </span>
            {seat && (
              <>
                <span className="max-w-full font-body text-sm text-app-ink">
                  {seat.account ? <PlayerName account={seat.account} you={seat.own} /> : "—"}
                </span>
                {answer ? <RatingFigure rating={answer.rating} /> : <span className="text-sm text-app-muted">—</span>}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/**
 * Where a slot's lobby would draw seats: the one number the ledger keeps for it, its registrations, and until its close
 * why there are no seats yet. A dash until the ledger answers.
 */
export const RegisteredCount = ({ slot, closed }: { slot: PlaytestSlot; closed: boolean }) => {
  const registered = useSlotRegistered(slot);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <AppFigure
        icon="people"
        tone="gold"
        value={registered === undefined ? "—" : formatAmount(registered)}
        label={BLITZ_WORDS.registeredUnit}
      />
      {!closed && <p className="max-w-[22rem] text-app-body text-app-muted">{BLITZ_WORDS.drawnAtClose(BLITZ_SEATS)}</p>}
    </div>
  );
};
