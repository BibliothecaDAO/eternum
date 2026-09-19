import { DISPLAYED_SLOT_NUMBER_MAP, GuardSlot } from "@bibliothecadao/types";

export const SLOT_ICON_MAP: Record<number, string> = {
  [GuardSlot.Alpha]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Alpha]}.png`,
  [GuardSlot.Beta]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Beta]}.png`,
  [GuardSlot.Gamma]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Gamma]}.png`,
  [GuardSlot.Delta]: `/image-icons/slots/slot${DISPLAYED_SLOT_NUMBER_MAP[GuardSlot.Delta]}.png`,
};
