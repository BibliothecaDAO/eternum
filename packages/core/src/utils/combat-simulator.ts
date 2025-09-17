import { BiomeType, RELICS, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
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
  battle_cooldown_end: number;
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
  stamina_defense_req: number;
  tick_interval_seconds: number;
}

export class CombatSimulator {
  private readonly t1DamageValue: number;
  private readonly t2DamageMultiplier: number;
  private readonly t3DamageMultiplier: number;
  private readonly staminaAttackThreshold: number;
  private readonly staminaDefenseThreshold: number;
  private readonly baseDamageFactor: number;
  private readonly tickIntervalSeconds: number;

  static MAX_U64: bigint = BigInt(2) ** BigInt(64);

  constructor(params: CombatParameters) {
    this.t1DamageValue = divideWithPrecision(params.t1_damage_value, CombatSimulator.MAX_U64);
    this.t2DamageMultiplier = divideWithPrecision(params.t2_damage_multiplier, CombatSimulator.MAX_U64);
    this.t3DamageMultiplier = divideWithPrecision(params.t3_damage_multiplier, CombatSimulator.MAX_U64);
    this.staminaAttackThreshold = params.stamina_attack_req;
    this.staminaDefenseThreshold = params.stamina_defense_req;

    this.baseDamageFactor = divideWithPrecision(params.damage_scaling_factor, CombatSimulator.MAX_U64);
    this.tickIntervalSeconds = params.tick_interval_seconds;
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
      return 1;
    } else {
      if (stamina < this.staminaDefenseThreshold) return 0.7;
      return 1;
    }
  }

  /**
   * Calculates damage modifier based on current cooldown status.
   * 
   * @param battle_cooldown_end - The CURRENT cooldown end time from the troops model
   * @param time - The current timestamp
   * @param isAttacker - Whether this is for the attacking army
   * @returns Damage modifier (0-1)
   */
  public calculateBattleTimerDamageModifier(battle_cooldown_end: number, time: number, isAttacker: boolean): number {
    const isOnCooldown = battle_cooldown_end > time;
    
    if (isAttacker) {
      // Attackers must not be on cooldown to initiate attacks
      // If they are on cooldown, they cannot attack (damage modifier = 0)
      return isOnCooldown ? 0 : 1;
    } else {
      // Defenders on cooldown deal 15% less damage when attacked (they fight less effectively)
      return isOnCooldown ? 0.85 : 1;
    }
  }

  public calculateRefundMultiplier(aDamage: number, bDamage: number): number {
    let ratio = aDamage / bDamage;
    if (ratio >= 10) {
      return 1;
    }
    if (ratio <= 2.5) {
      return 0;
    }

    return (ratio - 2.5) / (10 - 2.5);
  }

  private calculateEffectiveBeta(): number {
    return 0.2;
  }

  public calculateStaminaCost(baseStaminaCost: number, refundMultiplier: number): number {
    return baseStaminaCost - Math.ceil(baseStaminaCost * refundMultiplier);
  }

  public calculateNewStaminaAttacker(currentStamina: number, refundMultiplier: number): number {
    const staminaCost = this.calculateStaminaCost(this.staminaAttackThreshold, refundMultiplier);
    return currentStamina - staminaCost;
  }

  public calculateNewStaminaDefender(currentStamina: number, refundMultiplier: number): number {
    const staminaCost = this.calculateStaminaCost(this.staminaDefenseThreshold, refundMultiplier);
    return currentStamina - staminaCost;
  }

  public calculateNewCooldownEndAttacker(currentCooldownEnd: number, now: number, refundMultiplier: number): number {
    return this.calculateNextBattleCooldownEnd(currentCooldownEnd, now, refundMultiplier);
  }

  public calculateNewCooldownEndDefender(currentCooldownEnd: number, now: number, refundMultiplier: number): number {
    return this.calculateNextBattleCooldownEnd(currentCooldownEnd, now, refundMultiplier);
  }

  /**
   * Calculates the next battle cooldown end time after a combat.
   * This represents what the cooldown will be AFTER the battle, not the current cooldown.
   * 
   * @param currentCooldownEnd - The current cooldown end time from the troops model
   * @param now - The current timestamp
   * @param refundMultiplier - The refund multiplier based on battle outcome (0-1)
   * @returns The new cooldown end time that will be set after the battle
   */
  public calculateNextBattleCooldownEnd(currentCooldownEnd: number, now: number, refundMultiplier: number): number {
    // If the army is currently on cooldown, add to the existing cooldown
    // Otherwise, start a new cooldown from now
    const effectiveCooldownStart = Math.max(currentCooldownEnd, now);
    const additionalCooldown = Math.floor(this.tickIntervalSeconds * (1 - refundMultiplier));
    return effectiveCooldownStart + additionalCooldown;
  }

  /**
   * @deprecated Use calculateNextBattleCooldownEnd instead
   */
  public calculateBattleCooldownEnd(currentCooldownEnd: number, now: number, refundMultiplier: number): number {
    return this.calculateNextBattleCooldownEnd(currentCooldownEnd, now, refundMultiplier);
  }

  /**
   * Simulates a battle between two armies in a specific biome, with support for relic effects.
   *
   * @param attacker - The attacking army with troopCount, tier, troopType, and stamina
   * @param defender - The defending army with troopCount, tier, troopType, and stamina
   * @param biome - The biome type where the battle takes place, affecting troop bonuses
   * @param attackerRelics - Array of resource IDs representing attacker's active relic effects
   * @param defenderRelics - Array of resource IDs representing defender's active relic effects
   * @returns An object containing the damage dealt by each side:
   *          - attackerDamage: Amount of damage dealt by the attacker
   *          - defenderDamage: Amount of damage dealt by the defender
   */
  public simulateBattle(
    now: number,
    attacker: Army,
    defender: Army,
    biome: BiomeType,
    attackerRelics: ResourcesIds[] = [],
    defenderRelics: ResourcesIds[] = [],
  ): {
    attackerDamage: number;
    defenderDamage: number;
    attackerRefundMultiplier: number;
    defenderRefundMultiplier: number;
  } {
    const totalTroops = attacker.troopCount + defender.troopCount;
    const betaEff = this.calculateEffectiveBeta();

    if (totalTroops === 0) {
      return { attackerDamage: 0, defenderDamage: 0, attackerRefundMultiplier: 0, defenderRefundMultiplier: 0 };
    }

    // Calculate relic effects
    // Attacker damage relics increase damage output
    const attackerDamageRelics = RELICS.filter((r) => attackerRelics.includes(r.id) && r.type === "Damage");
    const attackerDamageMultiplierRelics =
      attackerDamageRelics.length > 0 ? Math.max(...attackerDamageRelics.map((r) => r.bonus)) : 1;

    // Defender damage reduction relics reduce incoming damage
    const defenderReductionRelics = RELICS.filter(
      (r) => defenderRelics.includes(r.id) && r.type === "Damage Reduction",
    );
    const defenderReductionMultiplierRelics =
      defenderReductionRelics.length > 0 ? Math.min(...defenderReductionRelics.map((r) => r.bonus)) : 1;

    // Defender damage relics increase damage output
    const defenderDamageRelics = RELICS.filter((r) => defenderRelics.includes(r.id) && r.type === "Damage");
    const defenderDamageMultiplierRelics =
      defenderDamageRelics.length > 0 ? Math.max(...defenderDamageRelics.map((r) => r.bonus)) : 1;

    // Attacker damage reduction relics reduce incoming damage
    const attackerReductionRelics = RELICS.filter(
      (r) => attackerRelics.includes(r.id) && r.type === "Damage Reduction",
    );
    const attackerReductionMultiplierRelics =
      attackerReductionRelics.length > 0 ? Math.min(...attackerReductionRelics.map((r) => r.bonus)) : 1;

    // Calculate base damage for attacker
    const baseAttackerDamage =
      (this.baseDamageFactor *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        this.calculateBattleTimerDamageModifier(attacker.battle_cooldown_end, now, true) *
        configManager.getBiomeCombatBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate base damage for defender
    const baseDefenderDamage =
      (this.baseDamageFactor *
        defender.troopCount *
        (this.getTierValue(defender.tier) / this.getTierValue(attacker.tier)) *
        this.calculateStaminaModifier(defender.stamina, false) *
        this.calculateBattleTimerDamageModifier(defender.battle_cooldown_end, now, false) *
        configManager.getBiomeCombatBonus(defender.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Apply relic modifiers
    const attackerDamage = baseAttackerDamage * attackerDamageMultiplierRelics * defenderReductionMultiplierRelics;
    const defenderDamage = baseDefenderDamage * defenderDamageMultiplierRelics * attackerReductionMultiplierRelics;

    const attackerRefundMultiplier = this.calculateRefundMultiplier(attackerDamage, defenderDamage);
    const defenderRefundMultiplier = this.calculateRefundMultiplier(defenderDamage, attackerDamage);

    return {
      attackerDamage,
      defenderDamage,
      attackerRefundMultiplier,
      defenderRefundMultiplier,
    };
  }

  public static getDefaultParameters(): CombatParameters {
    return {
      damage_raid_percent_num: 1000, //10%
      damage_biome_bonus_num: 3000,
      damage_beta_small: 4611686018427387904n, // 0.25
      damage_beta_large: 2213609288845146193n, // 0.12
      damage_scaling_factor: 36893488147419103232n, // 2
      damage_c0: 100_000n * CombatSimulator.MAX_U64, // 100_000
      damage_delta: 50_000n * CombatSimulator.MAX_U64, // 50_000
      t1_damage_value: 1844674407370955161600n, // 100
      t2_damage_multiplier: 46116860184273879040n, // 2.5
      t3_damage_multiplier: 129127208515966861312n, // 7
      stamina_attack_req: 50,
      stamina_defense_req: 40,
      tick_interval_seconds: 60,
    };
  }

  // Static method to simulate with default parameters
  public simulateBattleWithParams(
    now: number,
    attacker: Army,
    defender: Army,
    biome: BiomeType,
    attackerRelics: ResourcesIds[] = [],
    defenderRelics: ResourcesIds[] = [],
  ): {
    attackerDamage: number;
    defenderDamage: number;
    attackerRefundMultiplier: number;
    defenderRefundMultiplier: number;
  } {
    return this.simulateBattle(now, attacker, defender, biome, attackerRelics, defenderRelics);
  }
}
