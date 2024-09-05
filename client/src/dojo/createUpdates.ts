import { ID } from "@bibliothecadao/eternum";
import { numberToHex } from "../ui/utils/utils";
import { createEventSubscription } from "./events/createEventSubscription";
import {
  HYPERSTRUCTURE_CO_OWNER_CHANGE_SELECTOR,
  HYPERSTRUCTURE_FINISHED_SELECTOR,
  PILLAGE_SELECTOR,
} from "@/constants/events";

export const createUpdates = async () => {
  const eventUpdates = {
    createHyperstructureFinishedEvents: async () => createEventSubscription([HYPERSTRUCTURE_FINISHED_SELECTOR]),
    createHyperstructureCoOwnerChangeEvents: async () =>
      createEventSubscription([HYPERSTRUCTURE_CO_OWNER_CHANGE_SELECTOR]),
    createPillageHistoryEvents: async (structureId: ID, attackerRealmEntityId: ID) =>
      createEventSubscription(
        [PILLAGE_SELECTOR, numberToHex(structureId), numberToHex(attackerRealmEntityId)],
        true,
        20,
      ),
  };

  return {
    eventUpdates,
  };
};
