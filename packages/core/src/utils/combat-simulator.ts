import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { configManager } from "../managers";
import { divideWithPrecision } from "./utils";

export class Percentage {
  static _100() {
    return 10_000;
  }

  static get(value: number, numerator: number) {
    return (value * numerator) / Percentage._100();
  }
}

export interface Army {
  stamina: number;
  troopCount: number;
  troopType: TroopType;
  tier: TroopTier;
}

export interface CombatParameters {
  damage_raid_percent_num: number;
  damage_biome_bonus_num: number;
  damage_beta_small: bigint;
  damage_beta_large: bigint;
  damage_scaling_factor: bigint;
  damage_c0: bigint;
  damage_delta: bigint;
  t1_damage_value: bigint;
  t2_damage_multiplier: bigint;
  t3_damage_multiplier: bigint;
  stamina_attack_req: number;
}

export class CombatSimulator {
  private readonly t1DamageValue: number;
  private readonly t2DamageMultiplier: number;
  private readonly t3DamageMultiplier: number;
  private readonly staminaAttackThreshold: number;
  private readonly baseDamageFactor: number;
  private readonly betaSmall: number;
  private readonly betaLarge: number;
  private readonly c0: number;
  private readonly delta: number;

  static MAX_U64: bigint = BigInt(2) ** BigInt(64);

  constructor(params: CombatParameters) {
    this.t1DamageValue = divideWithPrecision(params.t1_damage_value, CombatSimulator.MAX_U64);
    this.t2DamageMultiplier = divideWithPrecision(params.t2_damage_multiplier, CombatSimulator.MAX_U64);
    this.t3DamageMultiplier = divideWithPrecision(params.t3_damage_multiplier, CombatSimulator.MAX_U64);
    this.staminaAttackThreshold = params.stamina_attack_req;
    this.baseDamageFactor = divideWithPrecision(params.damage_scaling_factor, CombatSimulator.MAX_U64);
    this.betaSmall = divideWithPrecision(params.damage_beta_small, CombatSimulator.MAX_U64);
    this.betaLarge = divideWithPrecision(params.damage_beta_large, CombatSimulator.MAX_U64);
    this.c0 = divideWithPrecision(params.damage_c0, CombatSimulator.MAX_U64);
    this.delta = divideWithPrecision(params.damage_delta, CombatSimulator.MAX_U64);
  }

  private getTierValue(tier: TroopTier): number {
    switch (tier) {
      case TroopTier.T1:
        return this.t1DamageValue;
      case TroopTier.T2:
        return this.t1DamageValue * this.t2DamageMultiplier;
      case TroopTier.T3:
        return this.t1DamageValue * this.t3DamageMultiplier;
    }
  }

  public calculateStaminaModifier(stamina: number, isAttacker: boolean): number {
    if (isAttacker) {
      if (stamina < this.staminaAttackThreshold) return 0;
      // max stamina bonus is 30%
      const extraStamina = Math.min(stamina - this.staminaAttackThreshold, this.staminaAttackThreshold);
      return 1 + extraStamina / 100;
    } else {
      // Defender stamina penalty
      return 0.7 + (0.3 * Math.min(stamina, 30)) / 30;
    }
  }

  private calculateEffectiveBeta(totalTroops: number): number {
    return (
      this.betaSmall - (this.betaSmall - this.betaLarge) * ((Math.tanh((totalTroops - this.c0) / this.delta) + 1) / 2)
    );
  }

  /**
   * Simulates a battle between two armies in a specific biome
   *
   * @param attacker - The attacking army with troopCount, tier, troopType, and stamina
   * @param defender - The defending army with troopCount, tier, troopType, and stamina
   * @param biome - The biome type where the battle takes place, affecting troop bonuses
   * @returns An object containing the damage dealt by each side:
   *          - attackerDamage: Amount of damage dealt by the attacker
   *          - defenderDamage: Amount of damage dealt by the defender
   */
  public simulateBattle(
    attacker: Army,
    defender: Army,
    biome: BiomeType,
  ): { attackerDamage: number; defenderDamage: number } {
    const totalTroops = attacker.troopCount + defender.troopCount;
    const betaEff = this.calculateEffectiveBeta(totalTroops);

    if (totalTroops === 0) {
      return { attackerDamage: 0, defenderDamage: 0 };
    }

    // Calculate attacker damage
    const attackerDamage =
      (this.baseDamageFactor *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        configManager.getBiomeCombatBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate defender damage
    const defenderDamage =
      (this.baseDamageFactor *
        defender.troopCount *
        (this.getTierValue(defender.tier) / this.getTierValue(attacker.tier)) *
        this.calculateStaminaModifier(defender.stamina, false) *
        configManager.getBiomeCombatBonus(defender.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    return {
      attackerDamage,
      defenderDamage,
    };
  }

  public static getDefaultParameters(): CombatParameters {
    return {
      damage_raid_percent_num: 1000, //10%
      damage_biome_bonus_num: 3000,
      damage_beta_small: 4611686018427387904n, // 0.25
      damage_beta_large: 2213609288845146193n, // 0.12
      damage_scaling_factor: 64563604257983430656n, // 3.5
      damage_c0: 100_000n * CombatSimulator.MAX_U64, // 100_000
      damage_delta: 50_000n * CombatSimulator.MAX_U64, // 50_000
      t1_damage_value: 1844674407370955161600n, // 100
      t2_damage_multiplier: 46116860184273879040n, // 2.5
      t3_damage_multiplier: 129127208515966861312n, // 7
      stamina_attack_req: 30,
    };
  }

  // Static method to simulate with default parameters
  public simulateBattleWithParams(
    attacker: Army,
    defender: Army,
    biome: BiomeType,
  ): { attackerDamage: number; defenderDamage: number } {
    return this.simulateBattle(attacker, defender, biome);
  }
}
