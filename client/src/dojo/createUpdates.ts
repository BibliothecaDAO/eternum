import { createEventSubscription } from "./createEventSubscription";
import { COMBAT_EVENT, CREATE_ORDER_EVENT, TRANSFER_EVENT, TRAVEL_EVENT } from "@bibliothecadao/eternum";
import { numberToHex } from "../utils/utils";

export const createUpdates = async () => {
  const eventUpdates = {
    createCombatEvents: async (entityId: bigint) =>
      createEventSubscription([COMBAT_EVENT, "*", numberToHex(Number(entityId))]),
    createTransferEvents: async (entityId: bigint) =>
      createEventSubscription([TRANSFER_EVENT, numberToHex(Number(entityId)), "*"]),
    createTravelEvents: async (x: number, y: number) =>
      createEventSubscription([TRAVEL_EVENT, numberToHex(x), numberToHex(y)]),
    createDirectOffersEvents: async (entityId: bigint) =>
      createEventSubscription([CREATE_ORDER_EVENT, numberToHex(Number(entityId)), "*"]),
    exploreMapEvents: async () => createEventSubscription([MAP_EXPLORED_EVENT]),
    exploreEntityMapEvents: async (entityId: bigint) =>
      createEventSubscription([MAP_EXPLORED_EVENT, "*", "*", numberToHex(Number(entityd))]),
  };

  return {
    eventUpdates,
  };
};
