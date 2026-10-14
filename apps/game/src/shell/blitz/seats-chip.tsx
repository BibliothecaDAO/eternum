import { Chip } from "@/ui/design-system/kit/chip";
import { formatAmount } from "@/ui/design-system/kit/amount";

import type { PlaytestSlot } from "../blitz-slot";

import type { BlitzRow } from "../blitz-rows";
import { BLITZ_WORDS } from "../words";
import { useSlotRegistered } from "./entry";

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
