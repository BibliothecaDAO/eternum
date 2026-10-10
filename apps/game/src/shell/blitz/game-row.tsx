import { useNavigate } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { formatAmount } from "@/ui/design-system/kit/amount";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import { ClockChip } from "../clock-chip";
import { entryHref } from "../game-links";
import { LiveChip, StateChip } from "../play/state-chip";
import { BLITZ_WORDS, WORDS } from "../words";
import { useSlotRegistered } from "./entry";
import { lobbyId, lobbyTitle } from "./lobby";

/**
 * A Blitz row's players as a chip: a game's seats taken of its roster ("17/24", the word only in its label); a slot's
 * registrations as the ledger counts them ("31 registered"), a dash until it answers.
 */
export const SeatsChip = ({ row }: { row: BlitzRow }) =>
  row.kind === "slot" ? (
    <RegisteredChip slot={row.slot} />
  ) : (
    <Chip icons={["Pp"]} value={`${row.seats.filled}/${row.seats.total}`} label={BLITZ_WORDS.seats} />
  );

const RegisteredChip = ({ slot }: { slot: PlaytestSlot }) => {
  const registered = useSlotRegistered(slot);
  return (
    <Chip
      icons={["Pp"]}
      value={registered === undefined ? "—" : formatAmount(registered)}
      label={BLITZ_WORDS.registered}
      unit={BLITZ_WORDS.registeredUnit}
    />
  );
};

/**
 * One Blitz in the list (spec 05): live with its end, or its start; its seats; one action: Watch a game the player is
 * not on, Enter their own, Open a slot's lobby to pay its entry, or the tick and Joined. The row opens its lobby.
 */
export const GameRow = ({ row, now }: { row: BlitzRow; now: number }) => {
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
        <SeatsChip row={row} />
      </span>
      <span className="relative ml-auto">
        <RowAction row={row} />
      </span>
    </li>
  );
};

const RowAction = ({ row }: { row: BlitzRow }) => {
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
    case "open":
      return (
        <Button role="primary" word={BLITZ_WORDS.open} icon="Pl" onClick={() => navigate(`/blitz/${lobbyId(row)}`)} />
      );
    case "registered":
      return <StateChip icon="Ok" text={WORDS.joined} />;
    case null:
      return null;
  }
};
