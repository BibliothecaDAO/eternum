import { BLITZ_WORDS } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";
import { AppChip } from "@/ui/design-system/kit/app-elements";

import type { PlaytestSlot } from "../blitz-slot";

import type { BlitzRow } from "../blitz-rows";
import { useSlotRegistered } from "./entry";

/**
 * A Blitz row's players as a chip: a game's seats taken of its roster ("17/24", the word only in its label); a slot's
 * registrations as the ledger counts them ("31 registered"), a dash until it answers.
 */
export const SeatsChip = ({ row }: { row: BlitzRow }) =>
  row.kind === "slot" ? (
    <RegisteredChip slot={row.slot} />
  ) : (
    <AppChip icon="people">
      <span aria-label={`${BLITZ_WORDS.seats} ${row.seats.filled}/${row.seats.total}`}>
        {`${row.seats.filled}/${row.seats.total}`}
      </span>
    </AppChip>
  );

const RegisteredChip = ({ slot }: { slot: PlaytestSlot }) => {
  const registered = useSlotRegistered(slot);
  return (
    <AppChip icon="people">{`${registered === undefined ? "—" : formatAmount(registered)} ${BLITZ_WORDS.registeredUnit}`}</AppChip>
  );
};
