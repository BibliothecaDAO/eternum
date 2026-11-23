import { BiomeType, RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";
import { resolveExchange, type CombatRules, type ExchangeRefusal, type ExchangeTroops } from "./combat-exchange";

export interface Army {
  oaths: number;
  stamina: number;
  maxStamina?: number;
  troopCount: number;
  troopType: TroopType;
  tier: TroopTier;
  battle_cooldown_end: number;
}

export interface CombatSimulationContext {
  attackerBiome?: BiomeType;
  defenderBiome?: BiomeType;
  defenderAlt?: boolean;
  attackerIsStructureGuard?: boolean;
  defenderIsStructureGuard?: boolean;
}

export interface CombatParameters {
  damage_biome_bonus_num: number;
  damage_scaling_factor: bigint;
  t1_damage_value: bigint;
  t2_damage_multiplier: bigint;
  t3_damage_multiplier: bigint;
  stamina_attack_req: number;
  stamina_defense_req: number;
  tick_interval_seconds: number;
}

export interface BattleOutcome {
  attackerDamage: number;
  defenderDamage: number;
  attackerStamina: number;
  defenderStamina: number;
  attackerCooldownEnd: number;
  defenderCooldownEnd: number;
}

type RefusedBattle = { ok: false; refusal: ExchangeRefusal };
type BattleSimulation = ({ ok: true } & BattleOutcome) | RefusedBattle;

/** Editable battle inputs resolve through the same fixed-point exchange as live forecasts. */
export class CombatSimulator {
  private readonly rules: CombatRules;

  constructor(params: CombatParameters, rules: CombatRules) {
    this.rules = {
      ...rules,
      tickSeconds: params.tick_interval_seconds,
      damage: {
        damage_biome_bonus_num: params.damage_biome_bonus_num,
        damage_scaling_factor: params.damage_scaling_factor,
        t1_damage_value: params.t1_damage_value,
        t2_damage_multiplier: params.t2_damage_multiplier,
        t3_damage_multiplier: params.t3_damage_multiplier,
      },
      stamina: {
        ...rules.stamina,
        stamina_attack_req: params.stamina_attack_req,
        stamina_defense_req: params.stamina_defense_req,
      },
    };
  }

  public simulateBattle(
    now: number,
    attacker: Army,
    defender: Army,
    biome: BiomeType,
    context: CombatSimulationContext,
  ): BattleSimulation {
    const result = resolveExchange(
      combatTroops(attacker, now),
      combatTroops(defender, now),
      {
        timestamp: now,
        attackerOaths: attacker.oaths,
        defenderOaths: defender.oaths,
        attackerTwin: null,
        attackerBiome: context.defenderAlt ? BiomeType.Underground : (context.attackerBiome ?? biome),
        defenderBiome: context.defenderAlt ? BiomeType.Underground : (context.defenderBiome ?? biome),
        attackerIsStructureGuard: context.attackerIsStructureGuard ?? false,
        defenderIsStructureGuard: context.defenderIsStructureGuard ?? false,
      },
      this.rules,
    );
    if (!result.ok) return result;
    return {
      ok: true,
      attackerDamage: Number(result.defenderLoss) / RESOURCE_PRECISION,
      defenderDamage: Number(result.attackerLoss) / RESOURCE_PRECISION,
      attackerStamina: Number(result.attacker.stamina.amount),
      defenderStamina: Number(result.defender.stamina.amount),
      attackerCooldownEnd: result.attacker.battle_cooldown_end,
      defenderCooldownEnd: result.defender.battle_cooldown_end,
    };
  }
}

const combatTroops = (army: Army, now: number): ExchangeTroops => ({
  category: army.troopType,
  tier: army.tier,
  count: BigInt(Math.round(army.troopCount * RESOURCE_PRECISION)),
  battle_cooldown_end: army.battle_cooldown_end,
  stamina: { amount: BigInt(Math.floor(army.stamina)), settled_at: now, remainder: 0 },
  ...(army.maxStamina === undefined ? {} : { staminaMax: army.maxStamina }),
  boosts: {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_at: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_at: 0,
    incr_stamina_regen_percent_num: 0,
    incr_stamina_regen_seconds_left: 0,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_at: 0,
  },
});
