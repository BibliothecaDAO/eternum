import {
  HYPERSTRUCTURE_CO_OWNER_CHANGE,
  HYPERSTRUCTURE_FINISHED_EVENT,
  ID,
  PILLAGE_EVENT,
} from "@bibliothecadao/eternum";
import { numberToHex } from "../ui/utils/utils";
import { createEventSubscription } from "./events/createEventSubscription";

export const createUpdates = async () => {
  const eventUpdates = {
    createHyperstructureFinishedEvents: async () => createEventSubscription([HYPERSTRUCTURE_FINISHED_EVENT]),
    createHyperstructureCoOwnerChangeEvents: async () => createEventSubscription([HYPERSTRUCTURE_CO_OWNER_CHANGE]),
    createPillageHistoryEvents: async (structureId: ID, attackerRealmEntityId: ID) =>
      createEventSubscription([PILLAGE_EVENT, numberToHex(structureId), numberToHex(attackerRealmEntityId)], true, 20),
  };

  return {
    eventUpdates,
  };
};
