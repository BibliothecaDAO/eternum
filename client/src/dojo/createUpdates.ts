import { createEventSubscription } from "./events/createEventSubscription";
import {
  COMBAT_EVENT,
  CREATE_ORDER_EVENT,
  MAP_EXPLORED_EVENT,
  PILLAGE_EVENT,
  TRANSFER_EVENT,
  TRAVEL_EVENT,
} from "@bibliothecadao/eternum";
import { numberToHex } from "../ui/utils/utils";

export const createUpdates = async () => {
  const eventUpdates = {
    createCombatEvents: async (entityId: bigint) =>
      createEventSubscription([COMBAT_EVENT, "*", numberToHex(Number(entityId)), "*"]),
    createTravelEvents: async (x: number, y: number) =>
      createEventSubscription([TRAVEL_EVENT, numberToHex(x), numberToHex(y)]),
    createDirectOffersEvents: async (entityId: bigint) =>
      createEventSubscription([CREATE_ORDER_EVENT, numberToHex(Number(entityId)), "*"]),
    createExploreMapEvents: async () => createEventSubscription([MAP_EXPLORED_EVENT], true, 1000, false),
    createExploreEntityMapEvents: async (entityId: bigint) =>
      createEventSubscription([MAP_EXPLORED_EVENT, numberToHex(Number(entityId))], false),
    createTravelHexEvents: async () => createEventSubscription([TRAVEL_EVENT], false),
    createPillageHistoryEvents: async (structureId: bigint, attackerRealmEntityId: bigint) =>
      createEventSubscription(
        [PILLAGE_EVENT, numberToHex(Number(structureId)), numberToHex(Number(attackerRealmEntityId))],
        true,
        5,
        false,
      ),
  };

  return {
    eventUpdates,
  };
};
