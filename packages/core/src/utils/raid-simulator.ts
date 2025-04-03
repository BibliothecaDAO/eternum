import { BiomeType } from "../constants";
import { Army, CombatParameters, CombatSimulator } from "./combat-simulator";

export enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

export class RaidSimulator {
  public readonly combatSimulator: CombatSimulator;
  public readonly params: CombatParameters;
  constructor(params: CombatParameters) {
    this.params = params;
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
  ): {
    raiderDamageTaken: number;
    defenderDamageTaken: number;
    damageTakenPerDefender: number[];
    outcomeType: RaidOutcome;
    successChance: number;
  } {
    // If no defenders, raid is automatically successful with no damage
    if (defenders.length === 0 || defenders.every((d) => d.troopCount === 0)) {
      return {
        raiderDamageTaken: 0,
        defenderDamageTaken: 0,
        damageTakenPerDefender: [],
        outcomeType: RaidOutcome.Success,
        successChance: 100,
      };
    }

    // Calculate total damage from all defenders and damage from raider
    let totalAttackerDamage = 0;
    let totalDefenderDamage = 0;
    const damageTakenPerDefender = [];

    // Calculate combined defensive damage for outcome determination
    // and damage to each defender
    for (const defender of defenders) {
      if (defender.troopCount > 0) {
        const combat = this.combatSimulator.simulateBattle(raider, defender, biome);
        const attackerDamage = Math.floor((combat.attackerDamage * this.params.damage_raid_percent_num) / 10_000);
        const defenderDamage = Math.floor((combat.defenderDamage * this.params.damage_raid_percent_num) / 10_000);

        totalAttackerDamage += attackerDamage;
        totalDefenderDamage += defenderDamage;

        // Accumulate damage to raider from all defenders
        damageTakenPerDefender.push(attackerDamage);
      }
    }

    // Determine raid outcome
    const outcomeType = this.raidOutcome(totalAttackerDamage, totalDefenderDamage);

    return {
      raiderDamageTaken: totalDefenderDamage,
      defenderDamageTaken: totalAttackerDamage,
      damageTakenPerDefender,
      outcomeType,
      successChance: this.calculateRaidSuccessChance(totalAttackerDamage, totalDefenderDamage),
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
