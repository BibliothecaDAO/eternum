import { EventType, NotificationType } from "../hooks/store/useNotificationsStore";
import { Event } from "../services/eventPoller";
import { Resource, CombatResultInterface, Winner } from "@bibliothecadao/eternum";

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

export const getBuildResourceCost = (quantity: number): { resourceId: number; amount: number }[] => {
  return [
    { resourceId: 254, amount: 1512000 * quantity },
    { resourceId: 255, amount: 504000 * quantity },
  ];
};

export const getHealResourceCost = (healthAmount: number): { resourceId: number; amount: number }[] => {
  return [
    { resourceId: 254, amount: 75600 * healthAmount },
    { resourceId: 255, amount: 25200 * healthAmount },
  ];
};

export const parseCombatEvent = (event: Event): CombatResultInterface => {
  const attackers_len = parseInt(event.data[0]);
  let attacking_entity_ids = [];
  for (let i = 0; i < attackers_len; i++) {
    attacking_entity_ids.push(BigInt(event.data[1 + i]));
  }
  const winner = parseInt(event.data[1 + attackers_len]) === 0 ? Winner.Attacker : Winner.Target;
  const stolen_resources_ids_len = parseInt(event.data[2 + attackers_len]);
  let stolen_resources: Resource[] = [];
  let nextIndex = 3 + attackers_len + stolen_resources_ids_len + 1;
  for (let i = 0; i < stolen_resources_ids_len; i++) {
    stolen_resources.push({
      resourceId: parseInt(event.data[3 + attackers_len + i]),
      amount: BigInt(event.data[nextIndex]),
    });
    nextIndex += 1;
  }
  let damage: number | undefined;
  let attackTimestamp: number | undefined;
  damage = parseInt(event.data[nextIndex]);
  attackTimestamp = parseInt(event.data[nextIndex + 1]);

  return {
    attackerRealmEntityId: BigInt(event.keys[1]),
    targetRealmEntityId: BigInt(event.keys[2]),
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
