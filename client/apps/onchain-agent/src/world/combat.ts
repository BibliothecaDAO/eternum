/**
 * Standalone combat simulator — identical math to the Cairo contracts and
 * `packages/core` CombatSimulator, but with zero Dojo ECS dependencies.
 *
 * Pure function: plain numbers in, deterministic result out.
 */

// ── Tier damage values (match on-chain t1_damage_value / multipliers) ──

/**
 * Base damage value per troop tier. T2 and T3 are multipliers of T1.
 *
 * - T1: 100 (baseline)
 * - T2: 250 (2.5x)
 * - T3: 700 (7x)
 */
const TIER_DAMAGE: Record<string, number> = {
  T1: 100,
  T2: 250, // 100 * 2.5
  T3: 700, // 100 * 7
};

// ── Biome combat bonus multiplier ──
// Returns a multiplier (e.g. 1.3 for +30%, 0.7 for -30%, 1.0 for neutral)
// Mirrors configManager.getBiomeCombatBonus from packages/core

/** Maps troop type name to its index in the biome bonus tuple. */
const TROOP_IDX: Record<string, number> = { Knight: 0, Crossbowman: 1, Paladin: 2 };

/**
 * Per-biome combat bonus for each troop type as `[Knight, Crossbowman, Paladin]`.
 * Values are fractions: 0.3 = +30% bonus, -0.3 = -30% penalty, 0 = neutral.
 *
 * Biome IDs follow the on-chain `BiomeType` enum.
 */
const BIOME_BONUS: Record<number, [number, number, number]> = {
  // Ocean/DeepOcean/Beach/Snow — Crossbowman +30%, Paladin -30%
  1: [0, 0.3, -0.3],
  2: [0, 0.3, -0.3],
  4: [0, 0.3, -0.3],
  // Scorched/Bare — Crossbowman +30%
  3: [-0.3, 0.3, 0],
  7: [-0.3, 0.3, 0],
  // Grassland/TemperateDesert/SubtropicalDesert/Shrubland/Tundra/Bare — Paladin +30%
  5: [0, -0.3, 0.3],
  6: [0, -0.3, 0.3],
  8: [0, -0.3, 0.3],
  9: [0, -0.3, 0.3],
  11: [0, -0.3, 0.3],
  14: [0, -0.3, 0.3],
  // Taiga/TemperateDeciduous/TemperateRain/TropicalSeasonal/TropicalRain — Knight +30%
  10: [0.3, 0, -0.3],
  12: [0.3, 0, -0.3],
  13: [0.3, 0, -0.3],
  15: [0.3, 0, -0.3],
  16: [0.3, 0, -0.3],
};

/**
 * Returns the combat multiplier for a troop type on a given biome.
 *
 * @param troopType - One of "Knight", "Crossbowman", or "Paladin".
 * @param biomeId - Numeric biome ID from the on-chain `BiomeType` enum.
 * @returns Multiplier applied to damage (e.g. 1.3 for +30%, 0.7 for -30%, 1.0 for neutral).
 */
function biomeCombatMultiplier(troopType: string, biomeId: number): number {
  const idx = TROOP_IDX[troopType];
  const bonuses = BIOME_BONUS[biomeId];
  if (idx === undefined || !bonuses) return 1;
  return 1 + bonuses[idx];
}

// ── Stamina modifiers ──

/** Minimum stamina required to attack at full effectiveness. Below this, damage is 0. */
const STAMINA_ATTACK_REQ = 50;

/** Minimum stamina for full defensive effectiveness. Below this, defense is reduced to 70%. */
const STAMINA_DEFENSE_REQ = 40;

/**
 * Returns the stamina-based damage modifier for an army.
 *
 * - Attackers: 1 if stamina >= 50, otherwise 0 (cannot attack).
 * - Defenders: 1 if stamina >= 40, otherwise 0.7 (30% penalty).
 *
 * @param stamina - Current stamina of the army.
 * @param isAttacker - Whether the army is the attacker.
 * @returns Multiplier in the range [0, 1].
 */
function staminaModifier(stamina: number, isAttacker: boolean): number {
  if (isAttacker) return stamina >= STAMINA_ATTACK_REQ ? 1 : 0;
  return stamina >= STAMINA_DEFENSE_REQ ? 1 : 0.7;
}

// ── Cooldown modifier ──

/**
 * Returns the cooldown-based damage modifier for an army.
 *
 * - Attackers on cooldown cannot attack (returns 0).
 * - Defenders on cooldown suffer a 15% penalty (returns 0.85).
 *
 * @param cooldownEnd - Unix timestamp when the battle cooldown expires.
 * @param now - Current Unix timestamp.
 * @param isAttacker - Whether the army is the attacker.
 * @returns Multiplier in the range [0, 1].
 */
function cooldownModifier(cooldownEnd: number, now: number, isAttacker: boolean): number {
  const onCooldown = cooldownEnd > now;
  if (isAttacker) return onCooldown ? 0 : 1;
  return onCooldown ? 0.85 : 1;
}

// ── Main simulation ──

/**
 * Input stats for one side of a combat simulation.
 */
export interface CombatInput {
  /** Number of troops in the army. */
  troopCount: number;
  /** Troop category: "Knight", "Crossbowman", or "Paladin". */
  troopType: string;
  /** Troop tier: "T1", "T2", or "T3". */
  troopTier: string;
  /** Current stamina points (attackers need >= 50, defenders >= 40 for full effect). */
  stamina: number;
  /** Unix timestamp when the battle cooldown expires. Defaults to 0 (no cooldown). */
  cooldownEnd?: number;
}

/**
 * Outcome of a combat simulation, including damage dealt, casualties, and the winner.
 */
export interface CombatResult {
  /** Total damage dealt by the attacker (before clamping to defender troop count). */
  attackerDamage: number;
  /** Total damage dealt by the defender (before clamping to attacker troop count). */
  defenderDamage: number;
  /** Number of attacker troops killed. */
  attackerCasualties: number;
  /** Number of defender troops killed. */
  defenderCasualties: number;
  /** Attacker troops remaining after battle. */
  attackerSurviving: number;
  /** Defender troops remaining after battle. */
  defenderSurviving: number;
  /** Which side wins, or "draw" if both are wiped out or both survive. */
  winner: "attacker" | "defender" | "draw";
  /** Human-readable summary of biome advantage (e.g. "favors attacker (Knight +30%)"). */
  biomeAdvantage: string;
}

/**
 * Simulate a battle between two armies. Uses the same deterministic math
 * as the Cairo contracts — the result is guaranteed to match on-chain.
 *
 * The damage formula accounts for troop count, tier ratio, stamina, cooldown,
 * and biome bonuses, scaled by a Lanchester-style `totalTroops^beta` denominator.
 *
 * @param attacker - Attacker army stats.
 * @param defender - Defender army stats.
 * @param biomeId - Biome ID of the tile where the battle occurs.
 * @returns Predicted battle outcome with casualties and winner.
 *
 * @example
 * ```ts
 * const result = simulateCombat(
 *   { troopCount: 1000, troopType: "Knight", troopTier: "T1", stamina: 100 },
 *   { troopCount: 800, troopType: "Paladin", troopTier: "T1", stamina: 60 },
 *   10, // Taiga biome — Knight +30%
 * );
 * // result.winner === "attacker"
 * // result.biomeAdvantage === "favors attacker (Knight +30%)"
 * ```
 */
export function simulateCombat(attacker: CombatInput, defender: CombatInput, biomeId: number): CombatResult {
  const now = Math.floor(Date.now() / 1000);
  const totalTroops = attacker.troopCount + defender.troopCount;
  const BETA_EFF = 0.2;
  const SCALING_FACTOR = 2; // damage_scaling_factor from config

  if (totalTroops === 0) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerCasualties: 0,
      defenderCasualties: 0,
      attackerSurviving: 0,
      defenderSurviving: 0,
      winner: "draw",
      biomeAdvantage: "neutral",
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
  if (atkBiome > defBiome)
    biomeAdvantage = `favors attacker (${attacker.troopType} +${Math.round((atkBiome - 1) * 100)}%)`;
  else if (defBiome > atkBiome)
    biomeAdvantage = `favors defender (${defender.troopType} +${Math.round((defBiome - 1) * 100)}%)`;

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
