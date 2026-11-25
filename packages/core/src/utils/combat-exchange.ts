import { oathAttackStamina, oathDamageMultiplier, oathFuryRefund, oathSkillMultiplier, oathTwinDamage } from "./oaths";
import { BiomeType, RESOURCE_PRECISION, type Troops } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../client/native-fact-store";
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
  cooldownSeconds: number;
  tickSeconds: number;
  damage: TroopDamageConfig;
  stamina: TroopStaminaConfig;
}

export const readCombatRules = (store: Pick<NativeFactStore, "require">, gameId: number): CombatRules => {
  const rules = store.require("SliceRules", { game_id: gameId });
  return {
    cooldownSeconds: rules.battle_config.cooldown_seconds,
    tickSeconds: Number(rules.tick_config.armies_tick_in_seconds),
    damage: rules.troop_damage_config,
    stamina: rules.troop_stamina_config,
  };
};

export const isCombatGuard = (owner: bigint | null): boolean => {
  if (owner === null) throw new Error("Combat guard owner is missing");
  return owner !== 0n;
};

interface ExchangeContext {
  timestamp: number;
  attackerBiome: BiomeType;
  defenderBiome: BiomeType;
  attackerIsStructureGuard: boolean;
  defenderIsStructureGuard: boolean;
  attackerOaths: number;
  defenderOaths: number;
  attackerTwin: ExchangeTroops | null;
}

export type ExchangeRefusal = "no-troops" | "cooldown" | "insufficient-stamina";

type FirstStrikeSide = "attacker" | "defender" | null;

export const resolveFirstStrike = (
  attacker: ExchangeTroops["category"],
  defender: ExchangeTroops["category"],
): FirstStrikeSide => {
  const attackerBow = attacker === "Crossbowman";
  const defenderBow = defender === "Crossbowman";
  if (attackerBow && !defenderBow) return "attacker";
  if (defenderBow && !attackerBow) return "defender";
  return null;
};

type ExchangeResult =
  | { ok: false; refusal: ExchangeRefusal }
  | {
      ok: true;
      firstStrike: FirstStrikeSide;
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

  const attackerBar = staminaAt(attacker, now, rules.stamina, rules.tickSeconds);
  const attackerStamina = attackerBar.amount;
  const defenderBar = staminaAt(defender, now, rules.stamina, rules.tickSeconds);
  const defenderStamina = defenderBar.amount;
  const attackStamina = BigInt(oathAttackStamina(context.attackerOaths, rules.stamina.stamina_attack_req));
  if (attackerStamina < attackStamina) return { ok: false, refusal: "insufficient-stamina" };

  const defenderStaminaRequired = BigInt(rules.stamina.stamina_defense_req);
  let defenderStaminaLoss = defenderStamina < defenderStaminaRequired ? defenderStamina : defenderStaminaRequired;
  let attackerStaminaLoss = attackStamina;

  const defenderCooldownMultiplier = defenderCooldownEnd > now ? percent(85) : ONE;
  const damage = exchangeDamage(attacker, defender, context, rules, {
    defenderCooldownMultiplier,
    attackerSkillMultiplier: oathSkillMultiplier(context.attackerOaths, attackerStamina - attackStamina),
  });
  const twin = context.attackerTwin
    ? exchangeDamage(context.attackerTwin, defender, { ...context, attackerOaths: 0 }, rules, {
        defenderCooldownMultiplier,
        attackerSkillMultiplier: ONE,
      }).attacker
    : ZERO;

  if (rules.stamina.damage_stamina_refund) {
    attackerStaminaLoss -= staminaRefund(attackerStaminaLoss, damage.attacker, damage.defender);
    defenderStaminaLoss -= staminaRefund(defenderStaminaLoss, damage.defender, damage.attacker);
  }

  const attackerDamage =
    toWhole(round(damage.attacker)) * PRECISION +
    oathTwinDamage(context.attackerOaths, toWhole(round(twin)) * PRECISION);
  const defenderDamage = toWhole(round(damage.defender)) * PRECISION;
  const attackerLoss = defenderDamage < attacker.count ? defenderDamage : attacker.count;
  const defenderLoss = attackerDamage < defender.count ? attackerDamage : defender.count;
  if (defenderLoss === defender.count && attackerLoss < attacker.count) {
    const refund = BigInt(oathFuryRefund(context.attackerOaths, Number(attackStamina)));
    attackerStaminaLoss -= refund < attackerStaminaLoss ? refund : attackerStaminaLoss;
  }
  return {
    ok: true,
    firstStrike: damage.firstStrike,
    attackerLoss,
    defenderLoss,
    attacker: afterExchange(
      attacker,
      attackerLoss,
      attackerStamina - attackerStaminaLoss,
      attackerBar,
      attackerCooldownEnd + exchangeCooldown(rules.cooldownSeconds, damage.attacker, damage.defender),
    ),
    defender: afterExchange(
      defender,
      defenderLoss,
      defenderStamina - defenderStaminaLoss,
      defenderBar,
      defenderCooldownEnd + exchangeCooldown(rules.cooldownSeconds, damage.defender, damage.attacker),
    ),
  };
};

const afterExchange = (
  troops: ExchangeTroops,
  loss: bigint,
  stamina: bigint,
  bar: ReturnType<typeof staminaAt>,
  cooldownEnd: number,
): ExchangeTroops => ({
  ...troops,
  count: troops.count - loss,
  battle_cooldown_end: cooldownEnd,
  stamina: { amount: stamina, settled_at: bar.settled_at, remainder: bar.remainder },
  boosts: { ...troops.boosts, incr_stamina_regen_seconds_left: bar.boostSecondsLeft },
});

const staminaRefund = (loss: bigint, dealt: Fixed, taken: Fixed): bigint =>
  toWhole(ceil(mul(unscaled(loss), refundMultiplier(dealt, taken))));

const exchangeCooldown = (seconds: number, dealt: Fixed, taken: Fixed): number =>
  Number(toWhole(mul(unscaled(seconds), sub(ONE, refundMultiplier(dealt, taken)))));

/** Both sides' damage in fixed point, before rounding, in the contract's order of operations. */
const exchangeDamage = (
  attacker: ExchangeTroops,
  defender: ExchangeTroops,
  context: ExchangeContext,
  rules: CombatRules,
  multipliers: { defenderCooldownMultiplier: Fixed; attackerSkillMultiplier: Fixed },
) => {
  const base = fixed(rules.damage.damage_scaling_factor);
  const attackerTroops = unscaled(attacker.count / PRECISION);
  const defenderTroops = unscaled(defender.count / PRECISION);
  const attackerTier = tierBonus(attacker.tier, rules.damage);
  const defenderTier = tierBonus(defender.tier, rules.damage);
  const attackerBiome = biomeBonus(attacker.category, context.attackerBiome, rules.damage);
  const defenderBiome = biomeBonus(defender.category, context.defenderBiome, rules.damage);
  const scale = pow(add(attackerTroops, defenderTroops), EFFECTIVE_BETA);

  let defenderDamage = [defenderTroops, defenderTier, defenderBiome, multipliers.defenderCooldownMultiplier].reduce(
    mul,
    base,
  );
  defenderDamage = div(div(defenderDamage, attackerTier), scale);
  let attackerDamage = [attackerTroops, attackerTier, attackerBiome].reduce(mul, base);
  attackerDamage = div(div(attackerDamage, defenderTier), scale);

  attackerDamage = mul(attackerDamage, incomingMultiplier(defender, context.defenderIsStructureGuard));
  defenderDamage = mul(defenderDamage, incomingMultiplier(attacker, context.attackerIsStructureGuard));
  if (attacker.category !== "Knight")
    attackerDamage = mul(attackerDamage, percent(nativeRuleConstants.FRONTIER_LIGHT_DAMAGE_PERCENT));
  if (defender.category !== "Knight")
    defenderDamage = mul(defenderDamage, percent(nativeRuleConstants.FRONTIER_LIGHT_DAMAGE_PERCENT));

  const attackerBoosts = activeBoosts(attacker, context.timestamp);
  const defenderBoosts = activeBoosts(defender, context.timestamp);
  attackerDamage = add(attackerDamage, div(mul(attackerDamage, unscaled(attackerBoosts.dealt)), BPS_100));
  defenderDamage = add(defenderDamage, div(mul(defenderDamage, unscaled(defenderBoosts.dealt)), BPS_100));
  defenderDamage = sub(defenderDamage, div(mul(defenderDamage, unscaled(attackerBoosts.gotten)), BPS_100));
  attackerDamage = sub(attackerDamage, div(mul(attackerDamage, unscaled(defenderBoosts.gotten)), BPS_100));

  attackerDamage = mul(
    attackerDamage,
    oathDamageMultiplier(context.attackerOaths, context.defenderOaths, context.defenderIsStructureGuard),
  );
  attackerDamage = mul(attackerDamage, multipliers.attackerSkillMultiplier);
  defenderDamage = mul(
    defenderDamage,
    oathDamageMultiplier(context.defenderOaths, context.attackerOaths, context.attackerIsStructureGuard),
  );
  const firstStrike = resolveFirstStrike(attacker.category, defender.category);
  if (firstStrike === "attacker") {
    defenderDamage = mul(defenderDamage, survivingFraction(defenderTroops, attackerDamage));
  } else if (firstStrike === "defender") {
    attackerDamage = mul(attackerDamage, survivingFraction(attackerTroops, defenderDamage));
  }
  return { attacker: attackerDamage, defender: defenderDamage, firstStrike };
};

const survivingFraction = (troops: Fixed, damage: Fixed): Fixed =>
  gte(damage, troops) ? ZERO : div(sub(troops, damage), troops);

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

const incomingMultiplier = (troops: ExchangeTroops, isStructureGuard: boolean): Fixed =>
  isStructureGuard && troops.category === "Knight"
    ? percent(nativeRuleConstants.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT)
    : unscaled(1);

const boostEnded = (endAt: number, timestamp: number): boolean => endAt !== 0 && timestamp >= endAt;

const activeBoosts = (troops: ExchangeTroops, timestamp: number) => ({
  dealt: boostEnded(troops.boosts.incr_damage_dealt_end_at, timestamp)
    ? 0
    : troops.boosts.incr_damage_dealt_percent_num,
  gotten: boostEnded(troops.boosts.decr_damage_gotten_end_at, timestamp)
    ? 0
    : troops.boosts.decr_damage_gotten_percent_num,
});

const refundMultiplier = (dealt: Fixed, taken: Fixed): Fixed => {
  if (dealt.mag === 0n) return ZERO;
  if (taken.mag === 0n) return ONE;
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
      stoppedBy?: ExchangeRefusal;
      /** What the first exchange alone costs each side: the one attack a player sends, as its result reads. */
      firstExchange: { attackerLoss: bigint; defenderLoss: bigint };
      /** What the whole fight costs each side, over every exchange. */
      attackerLoss: bigint;
      defenderLoss: bigint;
      staminaSpent: bigint;
      attacker: ExchangeTroops;
      defender: ExchangeTroops;
    };

/**
 * Attack after attack at the same moment until one side has no troops or the attacker lacks the stamina for another
 * exchange: how many exchanges a fight takes and what it costs, as the contract would resolve each one.
 */
export const forecastFight = (
  attacker: ExchangeTroops,
  defender: ExchangeTroops,
  context: ExchangeContext,
  rules: CombatRules,
): FightForecast => {
  const first = resolveExchange(attacker, defender, context, rules);
  if (!first.ok) return { outcome: "refused", refusal: first.refusal };
  const startingStamina = staminaAt(attacker, context.timestamp, rules.stamina, rules.tickSeconds).amount;
  let state = first;
  let exchanges = 1;
  let stoppedBy: ExchangeRefusal | undefined;
  let attackerLoss = first.attackerLoss;
  let defenderLoss = first.defenderLoss;
  while (state.attacker.count > 0n && state.defender.count > 0n) {
    const next = resolveExchange(state.attacker, state.defender, context, rules);
    if (!next.ok) {
      stoppedBy = next.refusal;
      break;
    }
    state = next;
    exchanges += 1;
    attackerLoss += next.attackerLoss;
    defenderLoss += next.defenderLoss;
  }
  const outcome = state.attacker.count === 0n ? "loses" : state.defender.count === 0n ? "wins" : "stalls";
  return {
    outcome,
    exchanges,
    stoppedBy,
    firstExchange: { attackerLoss: first.attackerLoss, defenderLoss: first.defenderLoss },
    attackerLoss,
    defenderLoss,
    staminaSpent: startingStamina - state.attacker.stamina.amount,
    attacker: state.attacker,
    defender: state.defender,
  };
};
