import { DISPLAYED_SLOT_NUMBER_MAP, GuardSlot } from "@bibliothecadao/types";

export const SLOT_ICON_MAP: Record<number, string> = {
  [GuardSlot.Alpha]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Alpha]}.png`,
  [GuardSlot.Bravo]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Bravo]}.png`,
  [GuardSlot.Charlie]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Charlie]}.png`,
  [GuardSlot.Delta]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Delta]}.png`,
};
