export enum TroopType {
  KNIGHT = "knight",
  CROSSBOWMAN = "crossbowman",
  PALADIN = "paladin",
}

export enum Biome {
  OCEAN = "ocean",
  DEEP_OCEAN = "deep_ocean",
  BEACH = "beach",
  GRASSLAND = "grassland",
  SHRUBLAND = "shrubland",
  SUBTROPICAL_DESERT = "subtropical_desert",
  TEMPERATE_DESERT = "temperate_desert",
  TROPICAL_RAINFOREST = "tropical_rainforest",
  TROPICAL_SEASONAL_FOREST = "tropical_seasonal_forest",
  TEMPERATE_RAINFOREST = "temperate_rainforest",
  TEMPERATE_DECIDUOUS_FOREST = "temperate_deciduous_forest",
  TUNDRA = "tundra",
  TAIGA = "taiga",
  SNOW = "snow",
  BARE = "bare",
  SCORCHED = "scorched",
}

export interface Army {
  stamina: number;
  troopCount: number;
  troopType: TroopType;
  tier: 1 | 2 | 3;
}

export class CombatSimulator {
  private static readonly BASE_T1_VALUE = 100; // Adjust this baseline value as needed
  private static readonly STAMINA_ATTACK_THRESHOLD = 30;
  //   private static readonly MAX_STAMINA_BONUS = 0.3; // 30%
  private static readonly BASE_DAMAGE_FACTOR = 3.5;

  // Combat scaling parameters
  private static readonly BETA_SMALL = 0.25;
  private static readonly BETA_LARGE = 0.12;
  private static readonly C0 = 100_000; // Transition point
  private static readonly DELTA = 50_000; // Transition width

  public static getBiomeBonus(troopType: TroopType, biome: Biome): number {
    const biomeModifiers: Record<Biome, Record<TroopType, number>> = {
      [Biome.OCEAN]: { [TroopType.KNIGHT]: 0, [TroopType.CROSSBOWMAN]: 0.3, [TroopType.PALADIN]: -0.3 },
      [Biome.DEEP_OCEAN]: { [TroopType.KNIGHT]: 0, [TroopType.CROSSBOWMAN]: 0.3, [TroopType.PALADIN]: -0.3 },
      [Biome.BEACH]: { [TroopType.KNIGHT]: -0.3, [TroopType.CROSSBOWMAN]: 0.3, [TroopType.PALADIN]: 0 },
      [Biome.GRASSLAND]: { [TroopType.KNIGHT]: 0, [TroopType.CROSSBOWMAN]: -0.3, [TroopType.PALADIN]: 0.3 },
      [Biome.SHRUBLAND]: { [TroopType.KNIGHT]: 0, [TroopType.CROSSBOWMAN]: -0.3, [TroopType.PALADIN]: 0.3 },
      [Biome.SUBTROPICAL_DESERT]: { [TroopType.KNIGHT]: -0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: 0.3 },
      [Biome.TEMPERATE_DESERT]: { [TroopType.KNIGHT]: -0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: 0.3 },
      [Biome.TROPICAL_RAINFOREST]: { [TroopType.KNIGHT]: 0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: -0.3 },
      [Biome.TROPICAL_SEASONAL_FOREST]: {
        [TroopType.KNIGHT]: 0.3,
        [TroopType.CROSSBOWMAN]: 0,
        [TroopType.PALADIN]: -0.3,
      },
      [Biome.TEMPERATE_RAINFOREST]: { [TroopType.KNIGHT]: 0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: -0.3 },
      [Biome.TEMPERATE_DECIDUOUS_FOREST]: {
        [TroopType.KNIGHT]: 0.3,
        [TroopType.CROSSBOWMAN]: 0,
        [TroopType.PALADIN]: -0.3,
      },
      [Biome.TUNDRA]: { [TroopType.KNIGHT]: -0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: 0.3 },
      [Biome.TAIGA]: { [TroopType.KNIGHT]: 0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: -0.3 },
      [Biome.SNOW]: { [TroopType.KNIGHT]: -0.3, [TroopType.CROSSBOWMAN]: 0.3, [TroopType.PALADIN]: 0 },
      [Biome.BARE]: { [TroopType.KNIGHT]: 0, [TroopType.CROSSBOWMAN]: -0.3, [TroopType.PALADIN]: 0.3 },
      [Biome.SCORCHED]: { [TroopType.KNIGHT]: 0.3, [TroopType.CROSSBOWMAN]: 0, [TroopType.PALADIN]: -0.3 },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  }

  private static getTierValue(tier: 1 | 2 | 3): number {
    switch (tier) {
      case 1:
        return this.BASE_T1_VALUE;
      case 2:
        return this.BASE_T1_VALUE * 2.5;
      case 3:
        return this.BASE_T1_VALUE * 7;
    }
  }

  private static calculateStaminaModifier(stamina: number, isAttacker: boolean): number {
    if (isAttacker) {
      if (stamina < this.STAMINA_ATTACK_THRESHOLD) return 0;
      // max stamina bonus is 30%
      const extraStamina = Math.min(stamina - this.STAMINA_ATTACK_THRESHOLD, this.STAMINA_ATTACK_THRESHOLD);
      return 1 + extraStamina / 100;
    } else {
      // Defender stamina penalty
      return 0.7 + (0.3 * Math.min(stamina, 30)) / 30;
    }
  }

  private static calculateEffectiveBeta(totalTroops: number): number {
    return (
      this.BETA_SMALL -
      (this.BETA_SMALL - this.BETA_LARGE) * ((Math.tanh((totalTroops - this.C0) / this.DELTA) + 1) / 2)
    );
  }

  public static simulateBattle(
    attacker: Army,
    defender: Army,
    biome: Biome,
  ): { attackerDamage: number; defenderDamage: number } {
    const totalTroops = attacker.troopCount + defender.troopCount;
    const betaEff = this.calculateEffectiveBeta(totalTroops);

    // Calculate attacker damage
    const attackerDamage =
      (this.BASE_DAMAGE_FACTOR *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        this.getBiomeBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate defender damage
    const defenderDamage =
      (this.BASE_DAMAGE_FACTOR *
        defender.troopCount *
        (this.getTierValue(defender.tier) / this.getTierValue(attacker.tier)) *
        this.calculateStaminaModifier(defender.stamina, false) *
        this.getBiomeBonus(defender.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    return {
      attackerDamage,
      defenderDamage,
    };
  }
}
