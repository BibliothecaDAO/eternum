import { createEventSubscription } from "./createEventSubscription";
import { COMBAT_EVENT, TRANSFER_EVENT, TRAVEL_EVENT } from "@bibliothecadao/eternum";
import { numberToHex } from "../utils/utils";

export const createUpdates = async () => {
  const eventUpdates = {
    createCombatEvents: async (entityId: bigint) =>
      createEventSubscription([COMBAT_EVENT, "*", numberToHex(Number(entityId))]),
    createTransferEvents: async (entityId: bigint) =>
      createEventSubscription([TRANSFER_EVENT, numberToHex(Number(entityId)), "*"]),
    createTravelEvents: async (x: number, y: number) =>
      createEventSubscription([TRAVEL_EVENT, numberToHex(x), numberToHex(y)]),
  };

  return {
    eventUpdates,
  };
};
