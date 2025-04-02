import { BiomeType } from "../constants";
import { Army, CombatParameters, CombatSimulator } from "./combat-simulator";

export enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

export class RaidSimulator {
  public readonly combatSimulator: CombatSimulator;

  constructor(params: CombatParameters) {
    this.combatSimulator = new CombatSimulator(params);
  }

  /**
   * Determines the raid outcome based on damage comparison
   * @param attackerDamage - Damage dealt by the raiding army
   * @param defenderDamage - Combined damage from all defender troops
   * @returns The raid outcome (Success, Failure, or Chance)
   */
  public raidOutcome(attackerDamage: number, defenderDamage: number): RaidOutcome {
    if (attackerDamage > defenderDamage * 2) {
      return RaidOutcome.Success;
    }
    if (defenderDamage > attackerDamage * 2) {
      return RaidOutcome.Failure;
    }
    return RaidOutcome.Chance;
  }

  /**
   * Calculates the probability of a successful raid when the outcome is "Chance"
   * @param attackerDamage - Damage dealt by the raiding army
   * @param defenderDamage - Combined damage from all defender troops
   * @returns Probability of success as a percentage (0-100)
   */
  public calculateRaidSuccessChance(attackerDamage: number, defenderDamage: number): number {
    if (defenderDamage === 0) return 100; // Always succeed if no defenders

    const ratio = attackerDamage / defenderDamage;

    if (ratio <= 0.5) {
      return 0;
    } else if (ratio >= 2) {
      return 100;
    } else {
      const successChance = ((ratio - 0.5) / 1.5) * 100;
      return this.clamp(successChance, 0, 100);
    }
  }

  /**
   * Determines if a raid is successful when the outcome is "Chance" using random probability
   * @param attackerDamage - Damage dealt by the raiding army
   * @param defenderDamage - Combined damage from all defender troops
   * @param randomValue - A random value between 0 and 1 for probability checking
   * @returns Whether the raid succeeds
   */
  public determineRaidSuccess(attackerDamage: number, defenderDamage: number, randomValue: number): boolean {
    const successChance = this.calculateRaidSuccessChance(attackerDamage, defenderDamage);
    return randomValue * 100 < successChance;
  }

  /**
   * Simulates a raid between a raiding army and multiple defending armies
   * @param raider - The raiding army
   * @param defenders - Array of defending armies
   * @param biome - The biome where the raid occurs
   * @param raidDamageMultiplier - Damage reduction factor for raids (e.g., 0.1 for 10% of normal damage)
   * @param randomValue - A random value between 0 and 1 for probability in Chance outcomes
   * @returns Object containing raid results
   */
  public simulateRaid(
    raider: Army,
    defenders: Army[],
    biome: BiomeType,
    raidDamageMultiplier: number = 0.1,
    randomValue: number = Math.random(),
  ): {
    isSuccessful: boolean;
    raiderDamageTaken: number;
    defenderDamageTaken: number;
    outcomeType: RaidOutcome;
    successChance: number;
  } {
    // If no defenders, raid is automatically successful with no damage
    if (defenders.length === 0 || defenders.every((d) => d.troopCount === 0)) {
      return {
        isSuccessful: true,
        raiderDamageTaken: 0,
        defenderDamageTaken: 0,
        outcomeType: RaidOutcome.Success,
        successChance: 100,
      };
    }

    // Calculate total damage from all defenders and damage from raider
    let totalDefenderDamage = 0;
    let damageToRaider = 0;
    let damageToFirstDefender = 0;

    // Only the first defender actually deals damage in the raid
    if (defenders.length > 0 && defenders[0].troopCount > 0) {
      const firstDefender = defenders[0];
      const combat = this.combatSimulator.simulateBattle(raider, firstDefender, biome);
      damageToFirstDefender = combat.attackerDamage;
      damageToRaider = combat.defenderDamage;
    }

    // Calculate combined defensive damage for outcome determination
    for (const defender of defenders) {
      if (defender.troopCount > 0) {
        const combat = this.combatSimulator.simulateBattle(raider, defender, biome);
        totalDefenderDamage += combat.defenderDamage;
      }
    }

    // Determine raid outcome
    const outcomeType = this.raidOutcome(damageToFirstDefender, totalDefenderDamage);
    let isSuccessful = false;

    switch (outcomeType) {
      case RaidOutcome.Success:
        isSuccessful = true;
        break;
      case RaidOutcome.Failure:
        isSuccessful = false;
        break;
      case RaidOutcome.Chance:
        isSuccessful = this.determineRaidSuccess(damageToFirstDefender, totalDefenderDamage, randomValue);
        break;
    }

    // Apply raid damage reduction
    const raiderDamageTaken = Math.floor(damageToRaider * raidDamageMultiplier);
    const defenderDamageTaken = Math.floor(damageToFirstDefender * raidDamageMultiplier);

    return {
      isSuccessful,
      raiderDamageTaken,
      defenderDamageTaken,
      outcomeType,
      successChance: this.calculateRaidSuccessChance(damageToFirstDefender, totalDefenderDamage),
    };
  }

  /**
   * Helper function to clamp a value between a minimum and maximum
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Creates a RaidSimulator with default combat parameters
   */
  public static withDefaultParameters(): RaidSimulator {
    return new RaidSimulator(CombatSimulator.getDefaultParameters());
  }
}
