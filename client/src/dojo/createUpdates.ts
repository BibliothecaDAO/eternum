import { Components } from "@latticexyz/recs";
import { createEntitySubscription } from "./createEntitySubscription";
import { createEventSubscription } from "./createEventSubscription";
import { COMBAT_EVENT, TRANSFER_EVENT } from "@bibliothecadao/eternum";
import { numberToHex } from "../utils/utils";

export const createUpdates = async (components: Components) => {
  const entityUpdates = await createEntitySubscription(components);
  const eventUpdates = {
    createCombatEvents: async (entityId: number) => createEventSubscription([COMBAT_EVENT, numberToHex(entityId), "*"]),
    createTransferEvents: async (entityId: number) =>
      createEventSubscription([TRANSFER_EVENT, numberToHex(entityId), "*"]),
  };

  return {
    entityUpdates,
    eventUpdates,
  };
};
