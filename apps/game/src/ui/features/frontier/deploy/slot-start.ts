import { ARMY, staminaReading, startsOn } from "@/ui/design-system/kit/words";

import type { SlotStart } from "./deploy-plan";

/**
 * A slot's start in words, the same on the Deploy sheet and on the dock's open slot: "Army 2 starts on 7/150 stamina".
 * None while its bar is unknown.
 */
const slotStartLine = (slot: SlotStart): string | undefined =>
  slot.start &&
  `${startsOn(`${ARMY} ${slot.number}`, staminaReading(slot.start.current, slot.start.max), !slot.inherited)}.`;

export const slotStart = (slot: SlotStart) => {
  const words = slotStartLine(slot);
  return slot.start && words ? { bar: slot.start, words } : undefined;
};
