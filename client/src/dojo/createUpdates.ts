import { Components } from "@dojoengine/recs";
import { createEntitySubscription } from "./createEntitySubscription";
import { createEventSubscription } from "./createEventSubscription";
import { COMBAT_EVENT, TRANSFER_EVENT } from "@bibliothecadao/eternum";
import { numberToHex } from "../utils/utils";

export const createUpdates = async (components: Components) => {
  const entityUpdates = await createEntitySubscription(components);
  const eventUpdates = {
    createCombatEvents: async (entityId: bigint) =>
      createEventSubscription([COMBAT_EVENT, numberToHex(Number(entityId)), "*"]),
    createTransferEvents: async (entityId: bigint) =>
      createEventSubscription([TRANSFER_EVENT, numberToHex(Number(entityId)), "*"]),
  };

  return {
    entityUpdates,
    eventUpdates,
  };
};
