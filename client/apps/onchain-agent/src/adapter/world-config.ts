/**
 * Cached WorldConfig — single SQL query for all on-chain game configuration.
 *
 * Replaces three separate hand-rolled fetch() calls to the same table.
 * Call fetchWorldConfig() once per session, then read fields from getWorldConfig().
 */
import { parseHexBig } from "./world-state";

const MAX_U64 = BigInt(2) ** BigInt(64);

function divideByU64(value: bigint): number {
  return Number(value) / Number(MAX_U64);
}

function hexNum(v: unknown): number {
  return Number(parseHexBig(v as string));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorldConfig {
  // Map
  mapCenterOffset: number;

  // Stamina
  armiesTickInSeconds: number;
  staminaGainPerTick: number;
  staminaKnightMax: number;
  staminaCrossbowmanMax: number;
  staminaPaladinMax: number;
  staminaAttackReq: number;
  staminaDefenseReq: number;

  // Combat (raw values for CombatSimulator)
  damageBiomeBonusNum: number;
  damageRaidPercentNum: number;
  damageScalingFactor: number;
  t1DamageValue: number;
  t2DamageMultiplier: number;
  t3DamageMultiplier: number;
}

// ---------------------------------------------------------------------------
// Query + cache
// ---------------------------------------------------------------------------

const WORLD_CONFIG_QUERY = `SELECT
  "map_center_offset" AS map_center_offset,
  "tick_config.armies_tick_in_seconds" AS armies_tick_in_seconds,
  "troop_stamina_config.stamina_gain_per_tick" AS gain_per_tick,
  "troop_stamina_config.stamina_knight_max" AS knight_max,
  "troop_stamina_config.stamina_crossbowman_max" AS crossbowman_max,
  "troop_stamina_config.stamina_paladin_max" AS paladin_max,
  "troop_stamina_config.stamina_attack_req" AS atk_req,
  "troop_stamina_config.stamina_defense_req" AS def_req,
  "troop_damage_config.damage_biome_bonus_num" AS biome_bonus,
  "troop_damage_config.damage_raid_percent_num" AS raid_percent,
  "troop_damage_config.damage_scaling_factor" AS scaling_factor,
  "troop_damage_config.t1_damage_value" AS t1_damage,
  "troop_damage_config.t2_damage_multiplier" AS t2_mult,
  "troop_damage_config.t3_damage_multiplier" AS t3_mult
FROM "s1_eternum-WorldConfig" LIMIT 1;`;

let _cached: WorldConfig | null = null;

/**
 * Fetch and cache the full WorldConfig from Torii SQL.
 * Call this once at startup (or on first tick). Subsequent calls return the cache.
 */
export async function fetchWorldConfig(sqlBaseUrl: string): Promise<WorldConfig> {
  if (_cached) return _cached;

  const url = `${sqlBaseUrl}?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`WorldConfig fetch failed: HTTP ${resp.status}`);
  }
  const rows = (await resp.json()) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) {
    throw new Error("WorldConfig: no rows returned from s1_eternum-WorldConfig");
  }

  _cached = {
    mapCenterOffset: hexNum(row.map_center_offset),
    armiesTickInSeconds: hexNum(row.armies_tick_in_seconds),
    staminaGainPerTick: hexNum(row.gain_per_tick),
    staminaKnightMax: hexNum(row.knight_max),
    staminaCrossbowmanMax: hexNum(row.crossbowman_max),
    staminaPaladinMax: hexNum(row.paladin_max),
    staminaAttackReq: hexNum(row.atk_req),
    staminaDefenseReq: hexNum(row.def_req),
    damageBiomeBonusNum: hexNum(row.biome_bonus),
    damageRaidPercentNum: hexNum(row.raid_percent),
    damageScalingFactor: divideByU64(parseHexBig(row.scaling_factor as string)),
    t1DamageValue: divideByU64(parseHexBig(row.t1_damage as string)),
    t2DamageMultiplier: divideByU64(parseHexBig(row.t2_mult as string)),
    t3DamageMultiplier: divideByU64(parseHexBig(row.t3_mult as string)),
  };
  return _cached;
}

/**
 * Get the cached WorldConfig. Throws if fetchWorldConfig() hasn't been called.
 */
export function getWorldConfig(): WorldConfig {
  if (!_cached) throw new Error("WorldConfig not loaded. Call fetchWorldConfig() first.");
  return _cached;
}
