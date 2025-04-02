import { BiomeType } from "../constants";
import { TroopTier, TroopType } from "../types";
import { RaidOutcome, RaidSimulator } from "./raid-simulator";

/**
 * This example demonstrates how to use the raid simulator in the game
 */
export function raidSimulatorExample() {
  // Create a raid simulator with default parameters
  const raidSimulator = RaidSimulator.withDefaultParameters();

  // Define a raiding army
  const raider = {
    troopCount: 200,
    troopType: TroopType.Knight,
    tier: TroopTier.T2,
    stamina: 100,
  };

  // Define defending armies
  const defenders = [
    {
      troopCount: 100,
      troopType: TroopType.Crossbowman,
      tier: TroopTier.T1,
      stamina: 100,
    },
    {
      troopCount: 50,
      troopType: TroopType.Paladin,
      tier: TroopTier.T1,
      stamina: 80,
    },
  ];

  // Set the biome where the raid takes place
  const biome = BiomeType.Grassland;

  // Damage multiplier for raids (e.g., 0.1 = 10% of normal damage)
  const raidDamageMultiplier = 0.1;

  // Simulate the raid
  const raidResult = raidSimulator.simulateRaid(raider, defenders, biome, raidDamageMultiplier);

  // Output raid results
  console.log("Raid Results:");
  console.log(`Success: ${raidResult.isSuccessful}`);
  console.log(`Outcome Type: ${raidResult.outcomeType}`);
  console.log(`Success Chance: ${raidResult.successChance.toFixed(2)}%`);
  console.log(`Raider Damage Taken: ${raidResult.raiderDamageTaken}`);
  console.log(`First Defender Damage Taken: ${raidResult.defenderDamageTaken}`);

  // Determine outcome
  let outcomeMessage = "";
  switch (raidResult.outcomeType) {
    case RaidOutcome.Success:
      outcomeMessage = "Raid was a guaranteed success! Resources stolen.";
      break;
    case RaidOutcome.Failure:
      outcomeMessage = "Raid was a guaranteed failure. No resources stolen.";
      break;
    case RaidOutcome.Chance:
      if (raidResult.isSuccessful) {
        outcomeMessage = `Raid succeeded with ${raidResult.successChance.toFixed(2)}% chance! Resources stolen.`;
      } else {
        outcomeMessage = `Raid failed with ${(100 - raidResult.successChance).toFixed(2)}% chance. No resources stolen.`;
      }
      break;
  }

  console.log(outcomeMessage);

  // Calculate troop losses
  const raiderTroopsLost = Math.floor(raidResult.raiderDamageTaken / 100); // Example conversion
  const defenderTroopsLost = Math.floor(raidResult.defenderDamageTaken / 100); // Example conversion

  console.log(`Raider troops lost: ${raiderTroopsLost}`);
  console.log(`Defender troops lost: ${defenderTroopsLost}`);

  return raidResult;
}

/**
 * Example of checking raid success probability before launching a raid
 */
export function checkRaidSuccessChance(
  raiderCount: number,
  raiderType: TroopType,
  raiderTier: TroopTier,
  defenderCounts: number[],
  defenderTypes: TroopType[],
  defenderTiers: TroopTier[],
  biome: BiomeType,
): number {
  // Create simulator
  const raidSimulator = RaidSimulator.withDefaultParameters();

  // Create raider
  const raider = {
    troopCount: raiderCount,
    troopType: raiderType,
    tier: raiderTier,
    stamina: 100, // Assuming full stamina
  };

  // Create defenders
  const defenders = defenderCounts.map((count, index) => ({
    troopCount: count,
    troopType: defenderTypes[index] || TroopType.Knight, // Default if not provided
    tier: defenderTiers[index] || TroopTier.T1, // Default if not provided
    stamina: 100, // Assuming full stamina
  }));

  // Only calculate success chance without simulating full raid
  let totalDefenderDamage = 0;
  let raiderDamage = 0;

  // Calculate potential damage
  for (const defender of defenders) {
    if (defender.troopCount > 0) {
      const combatResult = raidSimulator.combatSimulator.simulateBattle(raider, defender, biome);
      if (raiderDamage === 0) {
        raiderDamage = combatResult.attackerDamage; // First defender's potential damage
      }
      totalDefenderDamage += combatResult.defenderDamage;
    }
  }

  // Get success chance
  const successChance = raidSimulator.calculateRaidSuccessChance(raiderDamage, totalDefenderDamage);

  console.log(`Raid success chance: ${successChance.toFixed(2)}%`);

  // Provide strategy recommendation
  if (successChance >= 90) {
    console.log("Strategy: Excellent odds - proceed with raid");
  } else if (successChance >= 50) {
    console.log("Strategy: Good odds - proceed with caution");
  } else if (successChance >= 20) {
    console.log("Strategy: Poor odds - consider bringing more troops");
  } else {
    console.log("Strategy: Very poor odds - avoid this raid");
  }

  return successChance;
}
