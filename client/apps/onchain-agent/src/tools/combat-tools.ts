/**
 * Combat simulation tools — let the agent predict battle and raid outcomes
 * before committing troops. Uses the same math as packages/core CombatSimulator
 * but queries config from SQL instead of ECS.
 */
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { EternumClient } from "@bibliothecadao/client";
import { BiomeType, BiomeIdToType } from "@bibliothecadao/types";
import { getWorldConfig, type WorldConfig } from "../adapter/world-config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArmyInput {
  troopCount: number;
  troopType: string; // "Knight" | "Crossbowman" | "Paladin"
  tier: number; // 1, 2, or 3
  stamina: number;
  battleCooldownEnd?: number;
}

// ---------------------------------------------------------------------------
// Biome combat bonus — full matrix from config-manager.ts
// ---------------------------------------------------------------------------

type TroopKey = "Knight" | "Crossbowman" | "Paladin";

function getBiomeCombatBonus(troopType: TroopKey, biome: BiomeType, biomeBonus: number): number {
  const table: Record<string, Record<TroopKey, number>> = {
    [BiomeType.None]: { Knight: 0, Crossbowman: 0, Paladin: 0 },
    [BiomeType.Ocean]: { Knight: 0, Crossbowman: biomeBonus, Paladin: -biomeBonus },
    [BiomeType.DeepOcean]: { Knight: 0, Crossbowman: biomeBonus, Paladin: -biomeBonus },
    [BiomeType.Beach]: { Knight: -biomeBonus, Crossbowman: biomeBonus, Paladin: 0 },
    [BiomeType.Grassland]: { Knight: 0, Crossbowman: -biomeBonus, Paladin: biomeBonus },
    [BiomeType.Shrubland]: { Knight: 0, Crossbowman: -biomeBonus, Paladin: biomeBonus },
    [BiomeType.SubtropicalDesert]: { Knight: -biomeBonus, Crossbowman: 0, Paladin: biomeBonus },
    [BiomeType.TemperateDesert]: { Knight: -biomeBonus, Crossbowman: 0, Paladin: biomeBonus },
    [BiomeType.TropicalRainForest]: { Knight: biomeBonus, Crossbowman: 0, Paladin: -biomeBonus },
    [BiomeType.TropicalSeasonalForest]: { Knight: biomeBonus, Crossbowman: 0, Paladin: -biomeBonus },
    [BiomeType.TemperateRainForest]: { Knight: biomeBonus, Crossbowman: 0, Paladin: -biomeBonus },
    [BiomeType.TemperateDeciduousForest]: { Knight: biomeBonus, Crossbowman: 0, Paladin: -biomeBonus },
    [BiomeType.Tundra]: { Knight: -biomeBonus, Crossbowman: 0, Paladin: biomeBonus },
    [BiomeType.Taiga]: { Knight: biomeBonus, Crossbowman: 0, Paladin: -biomeBonus },
    [BiomeType.Snow]: { Knight: -biomeBonus, Crossbowman: biomeBonus, Paladin: 0 },
    [BiomeType.Bare]: { Knight: 0, Crossbowman: -biomeBonus, Paladin: biomeBonus },
    [BiomeType.Scorched]: { Knight: 0, Crossbowman: biomeBonus, Paladin: -biomeBonus },
  };
  return 1 + (table[biome]?.[troopType] ?? 0);
}

// ---------------------------------------------------------------------------
// Combat simulation — same math as packages/core/combat-simulator.ts
// ---------------------------------------------------------------------------

function getTierValue(tier: number, cfg: WorldConfig): number {
  if (tier === 3) return cfg.t1DamageValue * cfg.t3DamageMultiplier;
  if (tier === 2) return cfg.t1DamageValue * cfg.t2DamageMultiplier;
  return cfg.t1DamageValue;
}

function staminaModifier(stamina: number, isAttacker: boolean, cfg: WorldConfig): number {
  if (isAttacker) return stamina < cfg.staminaAttackReq ? 0 : 1;
  return stamina < cfg.staminaDefenseReq ? 0.7 : 1;
}

function cooldownModifier(cooldownEnd: number, now: number, isAttacker: boolean): number {
  const onCooldown = cooldownEnd > now;
  if (isAttacker) return onCooldown ? 0 : 1;
  return onCooldown ? 0.85 : 1;
}

function normalizeTroopType(t: string | number): TroopKey {
  const s = String(t).toLowerCase();
  if (s.includes("cross")) return "Crossbowman";
  if (s.includes("paladin") || s === "1") return "Paladin";
  return "Knight";
}

function simulateBattleMath(
  attacker: ArmyInput,
  defender: ArmyInput,
  biomeId: number,
  cfg: WorldConfig,
): {
  attackerDamage: number;
  defenderDamage: number;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerSurviving: number;
  defenderSurviving: number;
  winner: string;
  biomeAdvantage: string;
} {
  const now = Math.floor(Date.now() / 1000);
  const biome = BiomeIdToType[biomeId] ?? BiomeType.None;
  const biomeBonus = cfg.damageBiomeBonusNum / 10_000;
  const totalTroops = attacker.troopCount + defender.troopCount;
  const betaEff = 0.2; // hardcoded in CombatSimulator

  if (totalTroops === 0) {
    return {
      attackerDamage: 0, defenderDamage: 0,
      attackerCasualties: 0, defenderCasualties: 0,
      attackerSurviving: 0, defenderSurviving: 0,
      winner: "none", biomeAdvantage: "none",
    };
  }

  const atkType = normalizeTroopType(attacker.troopType);
  const defType = normalizeTroopType(defender.troopType);

  const atkBiome = getBiomeCombatBonus(atkType, biome, biomeBonus);
  const defBiome = getBiomeCombatBonus(defType, biome, biomeBonus);

  const attackerDamage =
    (cfg.damageScalingFactor *
      attacker.troopCount *
      (getTierValue(attacker.tier, cfg) / getTierValue(defender.tier, cfg)) *
      staminaModifier(attacker.stamina, true, cfg) *
      cooldownModifier(attacker.battleCooldownEnd ?? 0, now, true) *
      atkBiome) /
    Math.pow(totalTroops, betaEff);

  const defenderDamage =
    (cfg.damageScalingFactor *
      defender.troopCount *
      (getTierValue(defender.tier, cfg) / getTierValue(attacker.tier, cfg)) *
      staminaModifier(defender.stamina, false, cfg) *
      cooldownModifier(defender.battleCooldownEnd ?? 0, now, false) *
      defBiome) /
    Math.pow(totalTroops, betaEff);

  const attackerCasualties = Math.min(Math.floor(defenderDamage), attacker.troopCount);
  const defenderCasualties = Math.min(Math.floor(attackerDamage), defender.troopCount);

  let biomeAdvantage = "neutral";
  if (atkBiome > defBiome) biomeAdvantage = `favors attacker (${atkType} +${Math.round((atkBiome - 1) * 100)}%)`;
  else if (defBiome > atkBiome) biomeAdvantage = `favors defender (${defType} +${Math.round((defBiome - 1) * 100)}%)`;

  return {
    attackerDamage: Math.floor(attackerDamage),
    defenderDamage: Math.floor(defenderDamage),
    attackerCasualties,
    defenderCasualties,
    attackerSurviving: attacker.troopCount - attackerCasualties,
    defenderSurviving: defender.troopCount - defenderCasualties,
    winner: attackerDamage > defenderDamage ? "attacker" : "defender",
    biomeAdvantage,
  };
}

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

function logToolResponse(toolName: string, params: unknown, response: string) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "tool-responses.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    writeFileSync(debugPath, `\n[${ts}] ${toolName}(${JSON.stringify(params)})\n${response}\n`, { flag: "a" });
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

const simulateBattleSchema = {
  type: "object" as const,
  properties: {
    attackerTroopCount: { type: "number" as const, description: "Number of attacker troops" },
    attackerTroopType: {
      type: "string" as const,
      description: "Attacker troop type: Knight, Crossbowman, or Paladin",
    },
    attackerTier: { type: "number" as const, description: "Attacker troop tier: 1, 2, or 3" },
    attackerStamina: { type: "number" as const, description: "Attacker current stamina" },
    defenderTroopCount: { type: "number" as const, description: "Number of defender troops" },
    defenderTroopType: {
      type: "string" as const,
      description: "Defender troop type: Knight, Crossbowman, or Paladin",
    },
    defenderTier: { type: "number" as const, description: "Defender troop tier: 1, 2, or 3" },
    defenderStamina: { type: "number" as const, description: "Defender current stamina (use 100 if unknown)" },
    biomeId: {
      type: "number" as const,
      description:
        "Biome ID of the battle tile (0=None, 3=Beach, 4=Scorched, 5=Bare, 6=Tundra, 7=Snow, 8=Desert, 9=Shrubland, 10=Taiga, 11=Grassland, 12=Forest, 13=RainForest, 14=SubtropicalDesert, 15=TropicalForest, 16=TropicalRainForest)",
    },
  },
  required: [
    "attackerTroopCount",
    "attackerTroopType",
    "attackerTier",
    "attackerStamina",
    "defenderTroopCount",
    "defenderTroopType",
    "defenderTier",
    "defenderStamina",
    "biomeId",
  ],
};

const simulateRaidSchema = {
  type: "object" as const,
  properties: {
    raiderTroopCount: { type: "number" as const, description: "Number of raider troops" },
    raiderTroopType: { type: "string" as const, description: "Raider troop type: Knight, Crossbowman, or Paladin" },
    raiderTier: { type: "number" as const, description: "Raider troop tier: 1, 2, or 3" },
    raiderStamina: { type: "number" as const, description: "Raider current stamina" },
    defenderTroopCount: { type: "number" as const, description: "Total defender guard troops" },
    defenderTroopType: {
      type: "string" as const,
      description: "Defender troop type: Knight, Crossbowman, or Paladin",
    },
    defenderTier: { type: "number" as const, description: "Defender troop tier: 1, 2, or 3" },
    biomeId: { type: "number" as const, description: "Biome ID of the raid target tile" },
  },
  required: [
    "raiderTroopCount",
    "raiderTroopType",
    "raiderTier",
    "raiderStamina",
    "defenderTroopCount",
    "defenderTroopType",
    "defenderTier",
    "biomeId",
  ],
};

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createCombatTools(_client: EternumClient): AgentTool<any>[] {

  const simulateBattleTool: AgentTool<any> = {
    name: "simulate_battle",
    label: "Simulate Battle",
    description:
      "Predict the outcome of a battle BEFORE attacking. Shows expected casualties for both sides, " +
      "who wins, and biome advantage. Always simulate before committing to an attack. " +
      "Requires attacker stamina >= 50. Defender needs >= 40 stamina for full defense (70% if below).",
    parameters: simulateBattleSchema,
    async execute(_toolCallId: string, params: any) {
      const cfg = getWorldConfig();
      const result = simulateBattleMath(
        {
          troopCount: params.attackerTroopCount,
          troopType: params.attackerTroopType,
          tier: params.attackerTier,
          stamina: params.attackerStamina,
        },
        {
          troopCount: params.defenderTroopCount,
          troopType: params.defenderTroopType,
          tier: params.defenderTier,
          stamina: params.defenderStamina ?? 100,
        },
        params.biomeId,
        cfg,
      );

      const summary = [
        `Battle Prediction:`,
        `  Attacker: ${params.attackerTroopCount} ${params.attackerTroopType} T${params.attackerTier} (${params.attackerStamina} stamina)`,
        `  Defender: ${params.defenderTroopCount} ${params.defenderTroopType} T${params.defenderTier}`,
        `  Biome: ${BiomeIdToType[params.biomeId] ?? "Unknown"} — ${result.biomeAdvantage}`,
        `  ---`,
        `  Winner: ${result.winner.toUpperCase()}`,
        `  Attacker casualties: ${result.attackerCasualties} (${result.attackerSurviving} surviving)`,
        `  Defender casualties: ${result.defenderCasualties} (${result.defenderSurviving} surviving)`,
        `  Damage ratio: ${result.attackerDamage}:${result.defenderDamage}`,
      ].join("\n");

      logToolResponse("simulate_battle", params, summary);
      return {
        content: [{ type: "text" as const, text: summary }],
        details: result,
      };
    },
  };

  const simulateRaidTool: AgentTool<any> = {
    name: "simulate_raid",
    label: "Simulate Raid",
    description:
      "Predict the outcome of a raid BEFORE raiding. Raids deal 10% of normal battle damage and " +
      "can steal resources on success. Success if attacker damage > 2x defender, fail if < 0.5x, " +
      "chance-based in between. Always simulate before committing to a raid.",
    parameters: simulateRaidSchema,
    async execute(_toolCallId: string, params: any) {
      const cfg = getWorldConfig();
      const battleResult = simulateBattleMath(
        {
          troopCount: params.raiderTroopCount,
          troopType: params.raiderTroopType,
          tier: params.raiderTier,
          stamina: params.raiderStamina,
        },
        {
          troopCount: params.defenderTroopCount,
          troopType: params.defenderTroopType,
          tier: params.defenderTier,
          stamina: 100,
        },
        params.biomeId,
        cfg,
      );

      // Raid damage is 10% of battle damage
      const raidPercent = cfg.damageRaidPercentNum / 10_000;
      const raiderDamageDealt = Math.floor(battleResult.attackerDamage * raidPercent);
      const raiderDamageTaken = Math.floor(battleResult.defenderDamage * raidPercent);

      let outcome: string;
      let successChance = 0;
      if (raiderDamageDealt > raiderDamageTaken * 2) {
        outcome = "SUCCESS (guaranteed)";
        successChance = 100;
      } else if (raiderDamageTaken > raiderDamageDealt * 2) {
        outcome = "FAILURE (guaranteed)";
        successChance = 0;
      } else {
        const ratio = raiderDamageTaken === 0 ? 100 : raiderDamageDealt / raiderDamageTaken;
        successChance = Math.max(0, Math.min(100, ((ratio - 0.5) / 1.5) * 100));
        outcome = `CHANCE (${Math.round(successChance)}% success)`;
      }

      const summary = [
        `Raid Prediction:`,
        `  Raider: ${params.raiderTroopCount} ${params.raiderTroopType} T${params.raiderTier}`,
        `  Defender: ${params.defenderTroopCount} ${params.defenderTroopType} T${params.defenderTier}`,
        `  Biome: ${BiomeIdToType[params.biomeId] ?? "Unknown"} — ${battleResult.biomeAdvantage}`,
        `  ---`,
        `  Outcome: ${outcome}`,
        `  Raider casualties: ${Math.min(raiderDamageTaken, params.raiderTroopCount)}`,
        `  Defender casualties: ${Math.min(raiderDamageDealt, params.defenderTroopCount)}`,
      ].join("\n");

      logToolResponse("simulate_raid", params, summary);
      return {
        content: [{ type: "text" as const, text: summary }],
        details: { outcome, successChance, raiderDamageDealt, raiderDamageTaken },
      };
    },
  };

  return [simulateBattleTool, simulateRaidTool];
}
