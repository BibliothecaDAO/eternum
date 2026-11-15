import { BiomeType, RELICS, RESOURCE_PRECISION, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { COMBAT_DIE_FACES, resolveExchange, type CombatRules, type ExchangeRefusal, type ExchangeTroops } from "./combat-exchange";

export interface Army {
  stamina: number;
  troopCount: number;
  troopType: TroopType;
  tier: TroopTier;
  battle_cooldown_end: number;
}

export interface CombatSimulationContext {
  chargePercent: number;
  attackDistance?: number;
  attackerBiome?: BiomeType;
  defenderBiome?: BiomeType;
  defenderAlt?: boolean;
  attackerIsStructureGuard?: boolean;
  defenderIsStructureGuard?: boolean;
  /** Each side's d20 where the battle rolls dice: it adds that many percent to the side's damage; 0 without dice. */
  attackerRoll?: number;
  defenderRoll?: number;
}

export interface CombatParameters {
  day_unit_seconds: number;
  damage_biome_bonus_num: number;
  damage_scaling_factor: bigint;
  t1_damage_value: bigint;
  t2_damage_multiplier: bigint;
  t3_damage_multiplier: bigint;
  stamina_attack_req: number;
  stamina_defense_req: number;
  tick_interval_seconds: number;
}

interface BattleOutcome {
  attackerDamage: number;
  defenderDamage: number;
  attackerStamina: number;
  defenderStamina: number;
  attackerCooldownEnd: number;
  defenderCooldownEnd: number;
}

export interface BattleRange {
  worst: BattleOutcome;
  best: BattleOutcome;
}

type RefusedBattle = { ok: false; refusal: ExchangeRefusal };
type BattleSimulation = ({ ok: true } & BattleOutcome) | RefusedBattle;

/** Editable battle inputs resolve through the same fixed-point exchange as live forecasts. */
export class CombatSimulator {
  private readonly rules: CombatRules;

  constructor(params: CombatParameters, rules: CombatRules) {
    this.rules = {
      ...rules,
      dayUnitSeconds: params.day_unit_seconds,
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
    attackerRelics: ResourcesIds[],
    defenderRelics: ResourcesIds[],
    context: CombatSimulationContext,
  ): BattleSimulation {
    const result = resolveExchange(
      combatTroops(attacker, attackerRelics, now),
      combatTroops(defender, defenderRelics, now),
      {
        timestamp: now,
        chargePercent: context.chargePercent,
        attackDistance: context.attackDistance ?? 1,
        attackerBiome: context.defenderAlt ? BiomeType.Underground : context.attackerBiome ?? biome,
        defenderBiome: context.defenderAlt ? BiomeType.Underground : context.defenderBiome ?? biome,
        attackerIsStructureGuard: context.attackerIsStructureGuard ?? false,
        defenderIsStructureGuard: context.defenderIsStructureGuard ?? false,
        attackerRoll: context.attackerRoll ?? 0,
        defenderRoll: context.defenderRoll ?? 0,
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

  public simulateBattleRange(
    now: number,
    attacker: Army,
    defender: Army,
    biome: BiomeType,
    attackerRelics: ResourcesIds[],
    defenderRelics: ResourcesIds[],
    context: CombatSimulationContext,
    dice: boolean,
  ): ({ ok: true } & BattleRange) | RefusedBattle {
    const at = (attackerRoll: number, defenderRoll: number) =>
      this.simulateBattle(now, attacker, defender, biome, attackerRelics, defenderRelics, {
        ...context, attackerRoll, defenderRoll,
      });
    const worst = at(dice ? 1 : 0, dice ? COMBAT_DIE_FACES : 0);
    if (!worst.ok) return worst;
    const best = dice ? at(COMBAT_DIE_FACES, 1) : worst;
    if (!best.ok) return best;
    return { ok: true, worst, best };
  }
}

const combatTroops = (army: Army, relics: ResourcesIds[], now: number): ExchangeTroops => {
  const effects = RELICS.filter((relic) => relics.includes(relic.id));
  const dealt = Math.max(1, ...effects.filter((relic) => relic.type === "Damage").map((relic) => relic.bonus));
  const taken = Math.min(1, ...effects.filter((relic) => relic.type === "Damage Reduction").map((relic) => relic.bonus));
  return {
    category: army.troopType,
    tier: army.tier,
    count: BigInt(Math.round(army.troopCount * RESOURCE_PRECISION)),
    battle_cooldown_end: army.battle_cooldown_end,
    stamina: { amount: BigInt(Math.floor(army.stamina)), settled_at: now, remainder: 0 },
    boosts: {
      incr_damage_dealt_percent_num: Math.round((dealt - 1) * 10_000),
      incr_damage_dealt_end_at: 0,
      decr_damage_gotten_percent_num: Math.round((1 - taken) * 10_000),
      decr_damage_gotten_end_at: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_seconds_left: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_at: 0,
    },
  };
};
