/**
 * Standalone combat simulator — same math as the Cairo contracts and
 * packages/core CombatSimulator, but with zero Dojo ECS dependencies.
 *
 * Takes plain numbers in, returns plain numbers out.
 */

// ── Tier damage values (match on-chain t1_damage_value / multipliers) ──

const TIER_DAMAGE: Record<string, number> = {
  T1: 100,
  T2: 250, // 100 * 2.5
  T3: 700, // 100 * 7
};

// ── Biome combat bonus multiplier ──
// Returns a multiplier (e.g. 1.3 for +30%, 0.7 for -30%, 1.0 for neutral)
// Mirrors configManager.getBiomeCombatBonus from packages/core

const TROOP_IDX: Record<string, number> = { Knight: 0, Crossbowman: 1, Paladin: 2 };

// [Knight, Crossbowman, Paladin] bonus as fraction (0.3 = 30%)
const BIOME_BONUS: Record<number, [number, number, number]> = {
  // Ocean/DeepOcean/Beach/Snow — Crossbowman +30%, Paladin -30%
  1: [0, 0.3, -0.3], 2: [0, 0.3, -0.3], 4: [0, 0.3, -0.3],
  // Scorched/Bare — Crossbowman +30%
  3: [-0.3, 0.3, 0], 7: [-0.3, 0.3, 0],
  // Grassland/TemperateDesert/SubtropicalDesert/Shrubland/Tundra/Bare — Paladin +30%
  5: [0, -0.3, 0.3], 6: [0, -0.3, 0.3], 8: [0, -0.3, 0.3],
  9: [0, -0.3, 0.3], 11: [0, -0.3, 0.3], 14: [0, -0.3, 0.3],
  // Taiga/TemperateDeciduous/TemperateRain/TropicalSeasonal/TropicalRain — Knight +30%
  10: [0.3, 0, -0.3], 12: [0.3, 0, -0.3], 13: [0.3, 0, -0.3],
  15: [0.3, 0, -0.3], 16: [0.3, 0, -0.3],
};

function biomeCombatMultiplier(troopType: string, biomeId: number): number {
  const idx = TROOP_IDX[troopType];
  const bonuses = BIOME_BONUS[biomeId];
  if (idx === undefined || !bonuses) return 1;
  return 1 + bonuses[idx];
}

// ── Stamina modifiers ──

const STAMINA_ATTACK_REQ = 50;
const STAMINA_DEFENSE_REQ = 40;

function staminaModifier(stamina: number, isAttacker: boolean): number {
  if (isAttacker) return stamina >= STAMINA_ATTACK_REQ ? 1 : 0;
  return stamina >= STAMINA_DEFENSE_REQ ? 1 : 0.7;
}

// ── Cooldown modifier ──

function cooldownModifier(cooldownEnd: number, now: number, isAttacker: boolean): number {
  const onCooldown = cooldownEnd > now;
  if (isAttacker) return onCooldown ? 0 : 1;
  return onCooldown ? 0.85 : 1;
}

// ── Main simulation ──

export interface CombatInput {
  troopCount: number;
  troopType: string;  // "Knight" | "Crossbowman" | "Paladin"
  troopTier: string;  // "T1" | "T2" | "T3"
  stamina: number;
  cooldownEnd?: number; // battle_cooldown_end timestamp, default 0
}

export interface CombatResult {
  attackerDamage: number;
  defenderDamage: number;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerSurviving: number;
  defenderSurviving: number;
  winner: "attacker" | "defender" | "draw";
  biomeAdvantage: string;
}

/**
 * Simulate a battle between two armies. Uses the same deterministic math
 * as the Cairo contracts — the result is guaranteed to match on-chain.
 *
 * @param attacker - Attacker army stats.
 * @param defender - Defender army stats.
 * @param biomeId - Biome ID of the tile where the battle occurs.
 * @returns Predicted battle outcome with casualties and winner.
 */
export function simulateCombat(
  attacker: CombatInput,
  defender: CombatInput,
  biomeId: number,
): CombatResult {
  const now = Math.floor(Date.now() / 1000);
  const totalTroops = attacker.troopCount + defender.troopCount;
  const BETA_EFF = 0.2;
  const SCALING_FACTOR = 2; // damage_scaling_factor from config

  if (totalTroops === 0) {
    return {
      attackerDamage: 0, defenderDamage: 0,
      attackerCasualties: 0, defenderCasualties: 0,
      attackerSurviving: 0, defenderSurviving: 0,
      winner: "draw", biomeAdvantage: "neutral",
    };
  }

  const atkTier = TIER_DAMAGE[attacker.troopTier] ?? TIER_DAMAGE.T1;
  const defTier = TIER_DAMAGE[defender.troopTier] ?? TIER_DAMAGE.T1;
  const atkBiome = biomeCombatMultiplier(attacker.troopType, biomeId);
  const defBiome = biomeCombatMultiplier(defender.troopType, biomeId);

  const attackerDamage =
    (SCALING_FACTOR *
      attacker.troopCount *
      (atkTier / defTier) *
      staminaModifier(attacker.stamina, true) *
      cooldownModifier(attacker.cooldownEnd ?? 0, now, true) *
      atkBiome) /
    Math.pow(totalTroops, BETA_EFF);

  const defenderDamage =
    (SCALING_FACTOR *
      defender.troopCount *
      (defTier / atkTier) *
      staminaModifier(defender.stamina, false) *
      cooldownModifier(defender.cooldownEnd ?? 0, now, false) *
      defBiome) /
    Math.pow(totalTroops, BETA_EFF);

  const attackerCasualties = Math.min(Math.floor(defenderDamage), attacker.troopCount);
  const defenderCasualties = Math.min(Math.floor(attackerDamage), defender.troopCount);
  const attackerSurviving = attacker.troopCount - attackerCasualties;
  const defenderSurviving = defender.troopCount - defenderCasualties;

  let winner: CombatResult["winner"] = "draw";
  if (attackerSurviving > 0 && defenderSurviving <= 0) winner = "attacker";
  else if (defenderSurviving > 0 && attackerSurviving <= 0) winner = "defender";

  let biomeAdvantage = "neutral";
  if (atkBiome > defBiome) biomeAdvantage = `favors attacker (${attacker.troopType} +${Math.round((atkBiome - 1) * 100)}%)`;
  else if (defBiome > atkBiome) biomeAdvantage = `favors defender (${defender.troopType} +${Math.round((defBiome - 1) * 100)}%)`;

  return {
    attackerDamage: Math.floor(attackerDamage),
    defenderDamage: Math.floor(defenderDamage),
    attackerCasualties,
    defenderCasualties,
    attackerSurviving,
    defenderSurviving,
    winner,
    biomeAdvantage,
  };
}
