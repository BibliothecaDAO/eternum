import { ARMY, startsOn } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";

import type { SlotStart } from "./deploy-plan";

/**
 * A slot's start in words, the same on the Deploy sheet and on the dock's open slot: "Army 2 starts on 7/150 stamina".
 * None while its bar is unknown.
 */
export const slotStartLine = (slot: SlotStart): string | undefined =>
  slot.start &&
  startsOn(
    `${ARMY} ${slot.number}`,
    `${formatAmount(slot.start.current)}/${formatAmount(slot.start.max)}`,
    !slot.inherited,
  );
