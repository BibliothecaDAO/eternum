import { BattleInfo } from "@/hooks/helpers/battles/use-battles";
import { BattleSide } from "@bibliothecadao/eternum";
import { Components, ComponentValue } from "@dojoengine/recs";

const CONSIDERED_AS_DEAD_HEALTH = 0n;

export const generateMockBattle = (
  isAttackerAlive: boolean,
  isDefenderAlive: boolean,
  isStructureBattle: boolean,
): BattleInfo => {
  return {
    entity_id: 1n,
    attack_army: {
      troops: { knight_count: 1n, paladin_count: 1n, crossbowman_count: 1n },
      battle_id: 1n,
      battle_side: BattleSide.Attack,
    },
    attack_army_lifetime: {
      troops: { knight_count: 1n, paladin_count: 1n, crossbowman_count: 1n },
      battle_id: 1n,
      battle_side: BattleSide.Attack,
    },
    defence_army: {
      troops: { knight_count: 1n, paladin_count: 1n, crossbowman_count: 1n },
      battle_id: 1n,
      battle_side: BattleSide.Defence,
    },
    defence_army_lifetime: {
      troops: { knight_count: 1n, paladin_count: 1n, crossbowman_count: 1n },
      battle_id: 1n,
      battle_side: BattleSide.Defence,
    },
    attackers_resources_escrow_id: 1n,
    defenders_resources_escrow_id: 1n,
    attack_army_health: { current: isAttackerAlive ? 1000n : CONSIDERED_AS_DEAD_HEALTH, lifetime: 1000n },
    defence_army_health: { current: isDefenderAlive ? 1000n : CONSIDERED_AS_DEAD_HEALTH, lifetime: 1000n },
    attack_delta: 1n,
    defence_delta: 1n,
    last_updated: 1n,
    duration_left: 1n,
    x: 1,
    y: 1,
    isStructureBattle: isStructureBattle,
  } as unknown as BattleInfo;
};

export const generateMockArmy = (battleSide: BattleSide): ComponentValue<Components["Army"]["schema"]> => {
  return {
    troops: { knight_count: 1n, paladin_count: 1n, crossbowman_count: 1n },
    battle_id: 1n,
    battle_side: battleSide,
  };
};
