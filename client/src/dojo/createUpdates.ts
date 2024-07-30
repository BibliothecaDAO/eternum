import {
  COMBAT_EVENT,
  CREATE_ORDER_EVENT,
  HYPERSTRUCTURE_FINISHED_EVENT,
  ID,
  MAP_EXPLORED_EVENT,
  PILLAGE_EVENT,
  TRAVEL_EVENT,
} from "@bibliothecadao/eternum";
import { numberToHex } from "../ui/utils/utils";
import { createEventSubscription } from "./events/createEventSubscription";

export const createUpdates = async () => {
  const eventUpdates = {
    hyperstructureFinishedEvents: async () => createEventSubscription([HYPERSTRUCTURE_FINISHED_EVENT, "*"]),
    createCombatEvents: async (entityId: ID) =>
      createEventSubscription([COMBAT_EVENT, "*", numberToHex(Number(entityId)), "*"]),
    createTravelEvents: async (x: number, y: number) =>
      createEventSubscription([TRAVEL_EVENT, numberToHex(x), numberToHex(y)]),
    createDirectOffersEvents: async (entityId: ID) =>
      createEventSubscription([CREATE_ORDER_EVENT, numberToHex(Number(entityId)), "*"]),
    createExploreMapEvents: async () => createEventSubscription([MAP_EXPLORED_EVENT], true, 1000),
    createExploreEntityMapEvents: async (entityId: ID) =>
      createEventSubscription([MAP_EXPLORED_EVENT, numberToHex(Number(entityId))]),
    createTravelHexEvents: async () => createEventSubscription([TRAVEL_EVENT]),
    createPillageHistoryEvents: async (structureId: ID, attackerRealmEntityId: ID) =>
      createEventSubscription([PILLAGE_EVENT, numberToHex(structureId), numberToHex(attackerRealmEntityId)], true, 20),
  };

  return {
    eventUpdates,
  };
};
