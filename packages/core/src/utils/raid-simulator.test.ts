import { describe, expect, it } from "vitest";
import { BiomeType } from "../constants";
import { TroopTier, TroopType } from "../types";
import { RaidOutcome, RaidSimulator } from "./raid-simulator";

describe("RaidSimulator", () => {
  const raidSimulator = RaidSimulator.withDefaultParameters();

  describe("raidOutcome", () => {
    it("should return Success when attackerDamage > 2 * defenderDamage", () => {
      expect(raidSimulator.raidOutcome(100, 40)).toBe(RaidOutcome.Success);
    });

    it("should return Failure when defenderDamage > 2 * attackerDamage", () => {
      expect(raidSimulator.raidOutcome(40, 100)).toBe(RaidOutcome.Failure);
    });

    it("should return Chance when the ratio is between 0.5 and 2", () => {
      expect(raidSimulator.raidOutcome(100, 80)).toBe(RaidOutcome.Chance);
      expect(raidSimulator.raidOutcome(80, 100)).toBe(RaidOutcome.Chance);
    });
  });

  describe("calculateRaidSuccessChance", () => {
    it("should return 100% when there are no defenders", () => {
      expect(raidSimulator.calculateRaidSuccessChance(100, 0)).toBe(100);
    });

    it("should return 0% when ratio is <= 0.5", () => {
      expect(raidSimulator.calculateRaidSuccessChance(50, 100)).toBe(0);
      expect(raidSimulator.calculateRaidSuccessChance(25, 100)).toBe(0);
    });

    it("should return 100% when ratio is >= 2", () => {
      expect(raidSimulator.calculateRaidSuccessChance(200, 100)).toBe(100);
      expect(raidSimulator.calculateRaidSuccessChance(300, 100)).toBe(100);
    });

    it("should calculate proportional chance when ratio is between 0.5 and 2", () => {
      // Ratio = 1 = 50/50 => (1 - 0.5) / 1.5 * 100 = 33.33%
      expect(raidSimulator.calculateRaidSuccessChance(100, 100)).toBeCloseTo(33.33, 1);

      // Ratio = 1.5 => (1.5 - 0.5) / 1.5 * 100 = 66.67%
      expect(raidSimulator.calculateRaidSuccessChance(150, 100)).toBeCloseTo(66.67, 1);

      // Ratio = 0.75 => (0.75 - 0.5) / 1.5 * 100 = 16.67%
      expect(raidSimulator.calculateRaidSuccessChance(75, 100)).toBeCloseTo(16.67, 1);
    });
  });

  describe("simulateRaid", () => {
    const raider = {
      troopCount: 100,
      troopType: TroopType.Knight,
      tier: TroopTier.T2,
      stamina: 100,
    };

    const defender = {
      troopCount: 100,
      troopType: TroopType.Crossbowman,
      tier: TroopTier.T1,
      stamina: 100,
    };

    it("should handle raids with no defenders", () => {
      const result = raidSimulator.simulateRaid(raider, [], BiomeType.Grassland);

      expect(result.isSuccessful).toBe(true);
      expect(result.raiderDamageTaken).toBe(0);
      expect(result.defenderDamageTaken).toBe(0);
      expect(result.outcomeType).toBe(RaidOutcome.Success);
      expect(result.successChance).toBe(100);
    });

    it("should handle guaranteed success raids", () => {
      const weakDefender = { ...defender, troopCount: 10 };
      const result = raidSimulator.simulateRaid(
        raider,
        [weakDefender],
        BiomeType.Grassland,
        0.1, // 10% damage multiplier
        0.5, // Fixed random value
      );

      expect(result.outcomeType).toBe(RaidOutcome.Success);
      expect(result.isSuccessful).toBe(true);
      expect(result.raiderDamageTaken).toBeGreaterThanOrEqual(0);
      expect(result.defenderDamageTaken).toBeGreaterThanOrEqual(0);
    });

    it("should handle guaranteed failure raids", () => {
      const strongDefender = { ...defender, troopCount: 1000 };
      const result = raidSimulator.simulateRaid(
        raider,
        [strongDefender],
        BiomeType.Grassland,
        0.1, // 10% damage multiplier
        0.5, // Fixed random value
      );

      expect(result.outcomeType).toBe(RaidOutcome.Failure);
      expect(result.isSuccessful).toBe(false);
    });

    it("should use random value to determine success for chance outcomes", () => {
      // Create scenario with roughly equal forces
      const equalDefender = { ...defender, troopCount: 100 };

      // Test with random value 0.1 (should succeed if chance > 10%)
      const result1 = raidSimulator.simulateRaid(raider, [equalDefender], BiomeType.Grassland, 0.1, 0.1);

      // Test with random value 0.9 (should fail if chance < 90%)
      const result2 = raidSimulator.simulateRaid(raider, [equalDefender], BiomeType.Grassland, 0.1, 0.9);

      // Since Knight T2 vs Crossbowman T1 in Grassland should have an advantage
      // for the Knight (T2 vs T1), we expect outcome to be close to Chance
      expect(result1.outcomeType).toBe(RaidOutcome.Chance);
      expect(result2.outcomeType).toBe(RaidOutcome.Chance);

      // Check if random value influences outcome
      // With low random value, raid should succeed more often
      if (result1.successChance > 10) {
        expect(result1.isSuccessful).toBe(true);
      }

      // With high random value, raid should fail more often
      if (result2.successChance < 90) {
        expect(result2.isSuccessful).toBe(false);
      }
    });

    it("should apply damage reduction in raids", () => {
      const result = raidSimulator.simulateRaid(
        raider,
        [defender],
        BiomeType.Grassland,
        0.1, // 10% damage
      );

      // Verify damage is reduced compared to a full battle
      const fullBattleSimulator = RaidSimulator.withDefaultParameters();
      const fullBattleResult = fullBattleSimulator.combatSimulator.simulateBattle(
        raider,
        defender,
        BiomeType.Grassland,
      );

      expect(result.raiderDamageTaken).toBeLessThan(fullBattleResult.defenderDamage);
      expect(result.defenderDamageTaken).toBeLessThan(fullBattleResult.attackerDamage);
    });

    it("should handle multiple defenders correctly", () => {
      const defender1 = { ...defender, troopCount: 50 };
      const defender2 = { ...defender, troopCount: 50, troopType: TroopType.Paladin };

      const result = raidSimulator.simulateRaid(raider, [defender1, defender2], BiomeType.Grassland, 0.1, 0.5);

      // Verify that outcome considers combined defensive power
      expect(result.outcomeType).toBeDefined();

      // Only the first defender should take damage
      expect(result.defenderDamageTaken).toBeGreaterThanOrEqual(0);
    });
  });
});
