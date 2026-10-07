import { useNavigate } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { formatAmount } from "@/ui/design-system/kit/amount";

import type { BlitzRow } from "../blitz-rows";
import type { useJoinSlot } from "../blitz-slot";
import { ClockChip } from "../clock-chip";
import { entryHref } from "../game-links";
import { LiveChip, StateChip } from "../play/state-chip";
import { BLITZ_WORDS, WORDS } from "../words";
import { lobbyId, lobbyTitle } from "./lobby";

/** A Blitz game's seats as a chip: taken of the roster ("17/24"); the word lives only in its label. */
export const SeatsChip = ({ seats }: { seats: BlitzRow["seats"] }) => (
  <Chip icons={["Pp"]} value={`${formatAmount(seats.filled)}/${formatAmount(seats.total)}`} label={BLITZ_WORDS.seats} />
);

/**
 * One Blitz in the list (spec 05): live with its end, or its start; its seats; one action: Watch a game the player is
 * not on, Enter their own, Join a filling one (Joining… on the tapped button), or the tick and Joined. The row opens
 * the game's lobby.
 */
export const GameRow = ({ row, now, join }: { row: BlitzRow; now: number; join: ReturnType<typeof useJoinSlot> }) => {
  const navigate = useNavigate();
  return (
    <li className="relative flex flex-wrap items-center gap-2 border-b border-kit-line px-1 py-3 last:border-b-0">
      <button
        type="button"
        aria-label={lobbyTitle(row)}
        onClick={() => navigate(`/blitz/${lobbyId(row)}`)}
        className="absolute inset-0"
      />
      <span className="pointer-events-none flex flex-wrap items-center gap-2">
        {row.startsAt === null ? (
          <>
            <LiveChip />
            {row.kind === "game" && <ClockChip prefix="ends" at={row.game.clock.end_at} now={now} />}
          </>
        ) : (
          <ClockChip prefix="starts" at={row.startsAt} now={now} />
        )}
        <SeatsChip seats={row.seats} />
      </span>
      <span className="relative ml-auto">
        <RowAction row={row} join={join} />
      </span>
    </li>
  );
};

const RowAction = ({ row, join }: { row: BlitzRow; join: ReturnType<typeof useJoinSlot> }) => {
  const navigate = useNavigate();
  switch (row.action) {
    case "enter":
      return (
        row.kind === "game" && (
          <Button role="primary" word={WORDS.enter} icon="Pl" onClick={() => navigate(entryHref(row.game, "play"))} />
        )
      );
    case "spectate":
      return (
        row.kind === "game" && (
          <Button
            role="secondary"
            word={WORDS.watch}
            icon="Wc"
            onClick={() => navigate(entryHref(row.game, "spectate"))}
          />
        )
      );
    case "join":
      return (
        row.kind === "slot" && (
          <Button
            role="primary"
            word={WORDS.join}
            icon="Pl"
            loading={join.joining === row.slot.name ? BLITZ_WORDS.joining : undefined}
            onClick={() => join.join(row.slot)}
          />
        )
      );
    case "registered":
      return <StateChip icon="Ok" text={WORDS.joined} />;
    case null:
      return null;
  }
};
