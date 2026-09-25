import { BiomeType, RESOURCE_PRECISION, type Troops } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager } from "../managers/config-manager";
import { staminaAt } from "../managers/troop-stamina";
import {
  add,
  ceil,
  div,
  type Fixed,
  fixed,
  gte,
  lte,
  mul,
  ONE,
  pow,
  round,
  sub,
  toWhole,
  unscaled,
  ZERO,
} from "./cubit-fixed";

/**
 * One combat exchange exactly as the contract resolves it (logic/combat.cairo damage_with_context and
 * attack_with_context), in the contract's own fixed-point arithmetic, and a fight forecast built from repeated
 * exchanges. Nothing here estimates: a forecast is the contract's result for the same inputs.
 */
export type ExchangeTroops = Troops;
export type TroopDamageConfig = NativeRows["SliceRules"]["troop_damage_config"];
export type TroopStaminaConfig = NativeRows["SliceRules"]["troop_stamina_config"];

export interface CombatRules {
  damage: TroopDamageConfig;
  stamina: TroopStaminaConfig;
}

/** The active game's combat rules, as its SliceRules carries them. */
export const activeCombatRules = (): CombatRules => {
  const { troop_damage_config, troop_stamina_config } = configManager.getTroopConfig();
  return { damage: troop_damage_config, stamina: troop_stamina_config };
};

interface ExchangeContext {
  timestamp: number;
  currentTick: number;
  attackDistance: number;
  attackerBiome: BiomeType;
  defenderBiome: BiomeType;
  attackerIsStructureGuard: boolean;
  defenderIsStructureGuard: boolean;
  /** Each side's d20 where the game rolls dice, adding that many percent to its damage; 0 without dice. */
  attackerRoll: number;
  defenderRoll: number;
}

/** The faces of the die each side rolls where a game has combat dice. */
export const COMBAT_DIE_FACES = 20;

export type ExchangeRefusal = "no-troops" | "cooldown" | "insufficient-stamina";

type ExchangeResult =
  | { ok: false; refusal: ExchangeRefusal }
  | {
      ok: true;
      attackerLoss: bigint;
      defenderLoss: bigint;
      attacker: ExchangeTroops;
      defender: ExchangeTroops;
    };

const PRECISION = BigInt(RESOURCE_PRECISION);
const BPS_100 = unscaled(10_000);
const EFFECTIVE_BETA = div(unscaled(2), unscaled(10));
const REFUND_FLOOR = fixed(46116860184273879040n);
const REFUND_CEILING = fixed(184467440737095516160n);

const percent = (numerator: number): Fixed => div(fixed(BigInt(numerator)), fixed(100n));

/** One attack by `attacker` on `defender`; the defender answers in the same exchange unless the attack is ranged. */
export const resolveExchange = (
  attacker: ExchangeTroops,
  defender: ExchangeTroops,
  context: ExchangeContext,
  rules: CombatRules,
): ExchangeResult => {
  if (attacker.count === 0n || defender.count === 0n) return { ok: false, refusal: "no-troops" };
  const now = context.timestamp;
  const attackerCooldownEnd = Math.max(attacker.battle_cooldown_end, now);
  const defenderCooldownEnd = Math.max(defender.battle_cooldown_end, now);
  if (attackerCooldownEnd > now) return { ok: false, refusal: "cooldown" };

  const attackerStamina = staminaAt(attacker, context.currentTick, rules.stamina).amount;
  const defenderStamina = staminaAt(defender, context.currentTick, rules.stamina).amount;
  if (attackerStamina < BigInt(rules.stamina.stamina_attack_req)) return { ok: false, refusal: "insufficient-stamina" };

  const ranged = context.attackDistance > 1;
  const defenderStaminaRequired = ranged
    ? Math.floor(rules.stamina.stamina_defense_req / 2)
    : rules.stamina.stamina_defense_req;
  let defenderStaminaLoss =
    defenderStamina < BigInt(defenderStaminaRequired) ? defenderStamina : BigInt(defenderStaminaRequired);
  let attackerStaminaLoss = BigInt(rules.stamina.stamina_attack_req);
  const tired = !ranged && defenderStaminaLoss < BigInt(defenderStaminaRequired);

  const damage = exchangeDamage(attacker, defender, context, rules, {
    defenderStaminaMultiplier: tired ? div(fixed(7n), fixed(10n)) : ONE,
    defenderCooldownMultiplier: defenderCooldownEnd > now ? percent(85) : ONE,
  });

  if (!ranged) {
    const attackerRefund = ceil(mul(unscaled(attackerStaminaLoss), refundMultiplier(damage.attacker, damage.defender)));
    const defenderRefund = ceil(mul(unscaled(defenderStaminaLoss), refundMultiplier(damage.defender, damage.attacker)));
    if (rules.stamina.damage_stamina_refund) {
      attackerStaminaLoss -= toWhole(attackerRefund);
      defenderStaminaLoss -= toWhole(defenderRefund);
    }
  }

  const attackerDamage = toWhole(round(damage.attacker)) * PRECISION;
  const defenderDamage = ranged ? 0n : toWhole(round(damage.defender)) * PRECISION;
  const attackerLoss = defenderDamage < attacker.count ? defenderDamage : attacker.count;
  const defenderLoss = attackerDamage < defender.count ? attackerDamage : defender.count;
  return {
    ok: true,
    attackerLoss,
    defenderLoss,
    attacker: afterExchange(attacker, attackerLoss, attackerStamina - attackerStaminaLoss, context.currentTick),
    defender: afterExchange(defender, defenderLoss, defenderStamina - defenderStaminaLoss, context.currentTick),
  };
};

const afterExchange = (troops: ExchangeTroops, loss: bigint, stamina: bigint, tick: number): ExchangeTroops => ({
  ...troops,
  count: troops.count - loss,
  stamina: { amount: stamina, updated_tick: BigInt(tick) },
});

/** Both sides' damage in fixed point, before rounding, in the contract's order of operations. */
const exchangeDamage = (
  attacker: ExchangeTroops,
  defender: ExchangeTroops,
  context: ExchangeContext,
  rules: CombatRules,
  penalties: { defenderStaminaMultiplier: Fixed; defenderCooldownMultiplier: Fixed },
) => {
  const base = fixed(rules.damage.damage_scaling_factor);
  const attackerTroops = unscaled(attacker.count / PRECISION);
  const defenderTroops = unscaled(defender.count / PRECISION);
  const attackerTier = tierBonus(attacker.tier, rules.damage);
  const defenderTier = tierBonus(defender.tier, rules.damage);
  const attackerBiome =
    context.attackDistance > 1 ? ONE : biomeBonus(attacker.category, context.attackerBiome, rules.damage);
  const defenderBiome = biomeBonus(defender.category, context.defenderBiome, rules.damage);
  const scale = pow(add(attackerTroops, defenderTroops), EFFECTIVE_BETA);

  let defenderDamage = [
    defenderTroops,
    defenderTier,
    defenderBiome,
    penalties.defenderStaminaMultiplier,
    penalties.defenderCooldownMultiplier,
  ].reduce(mul, base);
  defenderDamage = div(div(defenderDamage, attackerTier), scale);
  let attackerDamage = [attackerTroops, attackerTier, ONE, attackerBiome, ONE].reduce(mul, base);
  attackerDamage = div(div(attackerDamage, defenderTier), scale);

  if (context.attackerRoll > COMBAT_DIE_FACES || context.defenderRoll > COMBAT_DIE_FACES)
    throw new Error("A combat die has twenty faces");
  attackerDamage = mul(attackerDamage, percent(100 + context.attackerRoll));
  defenderDamage = mul(defenderDamage, percent(100 + context.defenderRoll));
  attackerDamage = mul(attackerDamage, outgoingMultiplier(attacker, context));
  attackerDamage = mul(attackerDamage, incomingMultiplier(defender, context.defenderIsStructureGuard));
  defenderDamage = mul(defenderDamage, incomingMultiplier(attacker, context.attackerIsStructureGuard));
  if (context.attackDistance > 1) defenderDamage = ZERO;

  const attackerBoosts = activeBoosts(attacker, context.currentTick);
  const defenderBoosts = activeBoosts(defender, context.currentTick);
  attackerDamage = add(attackerDamage, div(mul(attackerDamage, unscaled(attackerBoosts.dealt)), BPS_100));
  defenderDamage = add(defenderDamage, div(mul(defenderDamage, unscaled(defenderBoosts.dealt)), BPS_100));
  defenderDamage = sub(defenderDamage, div(mul(defenderDamage, unscaled(attackerBoosts.gotten)), BPS_100));
  attackerDamage = sub(attackerDamage, div(mul(attackerDamage, unscaled(defenderBoosts.gotten)), BPS_100));
  return { attacker: attackerDamage, defender: defenderDamage };
};

const tierBonus = (tier: ExchangeTroops["tier"], damage: TroopDamageConfig): Fixed => {
  const t1 = fixed(damage.t1_damage_value);
  if (tier === "T1") return t1;
  return mul(t1, fixed(tier === "T2" ? damage.t2_damage_multiplier : damage.t3_damage_multiplier));
};

type BiomeEdge = readonly [bonus: boolean, applies: boolean];
const NEUTRAL: BiomeEdge = [false, false];

/** Each biome's edge per troop category, in Knight/Crossbowman/Paladin order: [bonus rather than penalty, applies]. */
const BIOME_EDGES: Partial<Record<BiomeType, readonly [BiomeEdge, BiomeEdge, BiomeEdge]>> = {
  ...Object.fromEntries(
    [BiomeType.DeepOcean, BiomeType.Ocean, BiomeType.Scorched].map((biome) => [
      biome,
      [NEUTRAL, [true, true], [false, true]],
    ]),
  ),
  ...Object.fromEntries(
    [BiomeType.Beach, BiomeType.Snow].map((biome) => [biome, [[false, true], [true, true], NEUTRAL]]),
  ),
  ...Object.fromEntries(
    [BiomeType.Bare, BiomeType.Shrubland, BiomeType.Grassland].map((biome) => [
      biome,
      [NEUTRAL, [false, true], [true, true]],
    ]),
  ),
  ...Object.fromEntries(
    [BiomeType.Tundra, BiomeType.TemperateDesert, BiomeType.SubtropicalDesert].map((biome) => [
      biome,
      [[false, true], NEUTRAL, [true, true]],
    ]),
  ),
  ...Object.fromEntries(
    [
      BiomeType.Taiga,
      BiomeType.TemperateDeciduousForest,
      BiomeType.TemperateRainForest,
      BiomeType.TropicalSeasonalForest,
      BiomeType.TropicalRainForest,
    ].map((biome) => [biome, [[true, true], NEUTRAL, [false, true]]]),
  ),
};

const CATEGORY_INDEX: Record<ExchangeTroops["category"], 0 | 1 | 2> = { Knight: 0, Crossbowman: 1, Paladin: 2 };

const biomeBonus = (category: ExchangeTroops["category"], biome: BiomeType, damage: TroopDamageConfig): Fixed => {
  const [bonus, applies] = BIOME_EDGES[biome]?.[CATEGORY_INDEX[category]] ?? NEUTRAL;
  if (!applies || damage.damage_biome_bonus_num === 0) return unscaled(1);
  const edge = unscaled(damage.damage_biome_bonus_num);
  return div(bonus ? add(BPS_100, edge) : sub(BPS_100, edge), BPS_100);
};

const outgoingMultiplier = (attacker: ExchangeTroops, context: ExchangeContext): Fixed => {
  const rangedCrossbow =
    attacker.category === "Crossbowman" && context.attackDistance > 1
      ? percent(context.defenderIsStructureGuard ? 30 : 70)
      : unscaled(1);
  const knightAssault =
    attacker.category === "Knight" &&
    !context.attackerIsStructureGuard &&
    context.defenderIsStructureGuard &&
    context.attackDistance === 1
      ? percent(115)
      : unscaled(1);
  return mul(rangedCrossbow, knightAssault);
};

const incomingMultiplier = (troops: ExchangeTroops, isStructureGuard: boolean): Fixed =>
  isStructureGuard && troops.category === "Knight" ? percent(85) : unscaled(1);

const activeBoosts = (troops: ExchangeTroops, currentTick: number) => ({
  dealt: troops.boosts.incr_damage_dealt_end_tick <= currentTick ? 0 : troops.boosts.incr_damage_dealt_percent_num,
  gotten: troops.boosts.decr_damage_gotten_end_tick <= currentTick ? 0 : troops.boosts.decr_damage_gotten_percent_num,
});

const refundMultiplier = (dealt: Fixed, taken: Fixed): Fixed => {
  const ratio = div(dealt, taken);
  if (gte(ratio, REFUND_CEILING)) return ONE;
  if (lte(ratio, REFUND_FLOOR)) return ZERO;
  return div(sub(ratio, REFUND_FLOOR), sub(REFUND_CEILING, REFUND_FLOOR));
};

export type FightForecast =
  | { outcome: "refused"; refusal: ExchangeRefusal }
  | {
      outcome: "wins" | "loses" | "stalls";
      exchanges: number;
      attackerLoss: bigint;
      defenderLoss: bigint;
      staminaSpent: bigint;
      attacker: ExchangeTroops;
      defender: ExchangeTroops;
    };

/**
 * Attack after attack at the same moment until one side has no troops or the attacker lacks the stamina for another
 * exchange: how many exchanges a fight takes and what it costs, as the contract would resolve each one. Where the game
 * rolls dice every exchange takes the context's rolls, so a range is the forecast at the worst and best rolls.
 */
export const forecastFight = (
  attacker: ExchangeTroops,
  defender: ExchangeTroops,
  context: ExchangeContext,
  rules: CombatRules,
): FightForecast => {
  const first = resolveExchange(attacker, defender, context, rules);
  if (!first.ok) return { outcome: "refused", refusal: first.refusal };
  const startingStamina = staminaAt(attacker, context.currentTick, rules.stamina).amount;
  let state = first;
  let exchanges = 1;
  let attackerLoss = first.attackerLoss;
  let defenderLoss = first.defenderLoss;
  while (state.attacker.count > 0n && state.defender.count > 0n) {
    const next = resolveExchange(state.attacker, state.defender, context, rules);
    if (!next.ok) break;
    state = next;
    exchanges += 1;
    attackerLoss += next.attackerLoss;
    defenderLoss += next.defenderLoss;
  }
  const outcome = state.defender.count === 0n ? "wins" : state.attacker.count === 0n ? "loses" : "stalls";
  return {
    outcome,
    exchanges,
    attackerLoss,
    defenderLoss,
    staminaSpent: startingStamina - state.attacker.stamina.amount,
    attacker: state.attacker,
    defender: state.defender,
  };
};
