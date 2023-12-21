import { Components } from "@dojoengine/recs";
import { createEventSubscription } from "./createEventSubscription";
import { COMBAT_EVENT, TRANSFER_EVENT } from "@bibliothecadao/eternum";
import { numberToHex } from "../utils/utils";

export const createUpdates = async (components: Components) => {
  const eventUpdates = {
    createCombatEvents: async (entityId: bigint) =>
      createEventSubscription([COMBAT_EVENT, numberToHex(Number(entityId)), "*"]),
    createTransferEvents: async (entityId: bigint) =>
      createEventSubscription([TRANSFER_EVENT, numberToHex(Number(entityId)), "*"]),
  };

  return {
    eventUpdates,
  };
};
