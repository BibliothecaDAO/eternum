// note: placeholder
// export const calculateStealSuccess = (raiders: number, defence: number) => {
//   if (!defence) return 1;
//   const success = raiders / (raiders + defence);
//   return success;
// };

import { EventType, NotificationType } from "../hooks/notifications/useNotifications";
import { CombatResultInterface, Winner } from "../hooks/store/useCombatHistoryStore";
import { Event } from "../services/eventPoller";
import { Resource } from "../types";

// note: placeholder
export const calculateSuccess = (
  attacker: { attack: number; health: number },
  defender: { defence: number; health: number } | undefined,
) => {
  if (!defender) return 1;
  const attacker_weight = attacker.attack * attacker.health;
  const total_weight = attacker_weight + defender.defence * defender.health;
  const success = attacker_weight / total_weight;
  return success;
};

// note: placeholder
export const calculateDamages = (attackers: number, defenders: number | undefined) => {
  return 1;
};

export const getResourceCost = (quantity: number): { resourceId: number; amount: number }[] => {
  return [
    { resourceId: 254, amount: 1512000 * quantity },
    { resourceId: 255, amount: 504000 * quantity },
  ];
};

export const parseCombatEvent = (event: Event): CombatResultInterface => {
  const attackers_len = parseInt(event.data[0]);
  let attacking_entity_ids = [];
  for (let i = 0; i < attackers_len; i++) {
    attacking_entity_ids.push(parseInt(event.data[1 + i]));
  }
  const winner = parseInt(event.data[1 + attackers_len]) === 0 ? Winner.Attacker : Winner.Target;
  const stolen_resources_ids_len = parseInt(event.data[2 + attackers_len]);
  let stolen_resources: Resource[] = [];
  let nextIndex = 3 + attackers_len + stolen_resources_ids_len + 1;
  for (let i = 0; i < stolen_resources_ids_len; i++) {
    stolen_resources.push({
      resourceId: parseInt(event.data[3 + attackers_len + i]),
      amount: parseInt(event.data[nextIndex]),
    });
    nextIndex += 1;
  }
  let damage: number | undefined;
  let attackTimestamp: number | undefined;
  if (event.data.length > nextIndex) {
    damage = parseInt(event.data[nextIndex]);
    attackTimestamp = parseInt(event.data[nextIndex + 1]);
  }

  return {
    attackerRealmEntityId: parseInt(event.keys[1]),
    targetRealmEntityId: parseInt(event.keys[2]),
    attackingEntityIds: attacking_entity_ids,
    winner,
    stolenResources: stolen_resources,
    damage,
    attackTimestamp,
  };
};

export const createCombatNotification = (result: CombatResultInterface): NotificationType => {
  let eventType = EventType.Attacked;
  if (result.stolenResources.length > 0) {
    eventType = EventType.StolenResource;
  }
  return {
    eventType,
    // to have a unique key for each notification
    keys: [result.attackTimestamp.toString()],
    data: result,
  };
};
