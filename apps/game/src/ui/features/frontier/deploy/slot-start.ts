import { ARMY, slotBarWhy, startsOn } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";

import type { SlotStart } from "./deploy-plan";

/**
 * A slot's start in words, the same on the Deploy sheet and on the dock's open slot: "Army 2 starts on 7/150
 * stamina", and why ("The bar its slot's last army left", "Its slot is fresh today"). None while its bar is unknown.
 */
export const slotStartWords = (slot: SlotStart): { line: string; why: string } | undefined =>
  slot.start && {
    line: startsOn(
      `${ARMY} ${slot.number}`,
      `${formatAmount(slot.start.current)}/${formatAmount(slot.start.max)}`,
      !slot.inherited,
    ),
    why: slotBarWhy(!slot.inherited),
  };
