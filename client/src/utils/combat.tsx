import { CombatResultInterface, Resource, Winner } from "@bibliothecadao/eternum";
import { Event } from "../services/eventPoller";

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
  const stolen_resources_ids_len = parseInt(event.data[1 + attackers_len]);
  let stolen_resources: Resource[] = [];
  let nextIndex = 2 + attackers_len + stolen_resources_ids_len;
  for (let i = 0; i < stolen_resources_ids_len; i++) {
    stolen_resources.push({
      resourceId: parseInt(event.data[2 + attackers_len + i]),
      amount: Number(event.data[nextIndex]),
    });
    nextIndex += 1;
  }
  const winner = parseInt(event.data[nextIndex]) === 0 ? Winner.Attacker : Winner.Target;
  nextIndex += 1;
  let damage: number | undefined;
  let attackTimestamp: number | undefined;
  damage = parseInt(event.data[nextIndex]);
  nextIndex += 1;
  attackTimestamp = parseInt(event.data[nextIndex]);

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
