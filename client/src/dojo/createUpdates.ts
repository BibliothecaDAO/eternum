import { HYPERSTRUCTURE_CO_OWNER_CHANGE_SELECTOR, HYPERSTRUCTURE_FINISHED_SELECTOR } from "@/constants/events";
import { createEventSubscription } from "./events/createEventSubscription";

export const createUpdates = async () => {
  const eventUpdates = {
    createHyperstructureFinishedEvents: async () => createEventSubscription([HYPERSTRUCTURE_FINISHED_SELECTOR]),
    createHyperstructureCoOwnerChangeEvents: async () =>
      createEventSubscription([HYPERSTRUCTURE_CO_OWNER_CHANGE_SELECTOR]),
  };

  return {
    eventUpdates,
  };
};
