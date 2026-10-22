import { type CombatRules, type ExchangeTroops, resolveExchange } from "@bibliothecadao/eternum/combat-exchange";
import { BiomeType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { buildTroopDamageConfig, buildTroopStaminaConfig } from "../../../../config/deployer/clean/registrar/preset";
import { blitzPreset } from "../../../../config/source/blitz/native";
import { nativeRuleConstants as rule } from "../../../../contracts/l3/world-native/schema/client.gen";
import { buildablePlotCount } from "../../../../packages/core/src/utils/castle-reach";

import {
  BLITZ_SLOT_INTERVAL_SECONDS,
  BLITZ_SLOT_PREPARATION_SECONDS,
} from "../../../../packages/value-ledger/src/blitz-timetable";
import { ETERNUM_CONFIG } from "./config";
import { CONTRACT } from "./contract-constants";

/**
 * Blitz's rules as its pages state them, read from the generated config the game is created with, the Blitz preset,
 * the contract's rule constants and the launch timetable. A page never writes one of these numbers by hand.
 */
const config = ETERNUM_CONFIG("blitz");
const stamina = config.troop.stamina;
const limit = config.troop.limit;
const points = config.victoryPoints;
const exploration = config.exploration;

/** Thousands with commas, as every page writes them. */
const n = (value: number) => value.toLocaleString("en-US");
const pct = (fraction: number) => `${n(Math.round(fraction * 1000) / 10)}%`;
const range = (lower: number, upper: number) => `${n(lower)}–${n(upper)}`;
/** Points are stored in millionths. */
const pointsOf = (value: bigint | number | string) => n(Number(value) / 1_000_000);

const RESOURCE = { labor: 23, wheat: 35, essence: 38, donkey: 25 } as const;
const startOf = (id: number) => {
  const stack = config.startingResources.find((each: { resource: number }) => each.resource === id);
  if (!stack) throw new Error(`Blitz starts no realm with resource ${id}`);
  return n(stack.amount);
};
const campStockOf = (id: number) => {
  const stack = config.campStartingResources.find((each: { resource: number }) => each.resource === id);
  if (!stack) throw new Error(`Blitz camps start with no resource ${id}`);
  return n(stack.max_amount);
};
const tickSeconds = config.tick.armiesTickIntervalInSeconds;
const LEVELS = ["Settlement", "City", "Kingdom", "Empire"] as const;

// Spires come first in a reveal's draw, then an Essence Rift, then a camp (contracts/l3/world-native/src/discovery.cairo).
const spireChance = CONTRACT.spireFindBps / 10_000;
const riftChance =
  (1 - spireChance) *
  (exploration.shardsMinesWinProbability /
    (exploration.shardsMinesWinProbability + exploration.shardsMinesFailProbability));
const campChance =
  (1 - spireChance - riftChance) *
  (exploration.campFindProbability / (exploration.campFindProbability + exploration.campFindFailProbability));

// Every timed relic lasts the same number of army ticks; the Stamina relics count theirs as uses (native-data.ts).
const timedRelic = blitzPreset.relics.find((relic) => relic.duration > 0);
if (!timedRelic) throw new Error("Blitz has no timed relic");

// A Blitz map's Hyperstructure rings stand this far apart: settlement_grid.cairo `distances(spacing).step`.
const ringStep = (blitzPreset.spacing * 3) / 2 + 3;

// The game's combat rules as the contract reads them: the deployer's own mapping of the config, its 64.64 fixed-point
// values as the bigints the exchange takes.
const FIXED_ONE = 2n ** 64n;
const damageRules = buildTroopDamageConfig(config);
const combatRules: CombatRules = {
  cooldownSeconds: config.battle.cooldownSeconds,
  tickSeconds,
  damage: {
    ...damageRules,
    damage_scaling_factor: BigInt(damageRules.damage_scaling_factor),
    t1_damage_value: BigInt(damageRules.t1_damage_value),
    t2_damage_multiplier: BigInt(damageRules.t2_damage_multiplier),
    t3_damage_multiplier: BigInt(damageRules.t3_damage_multiplier),
  },
  stamina: buildTroopStaminaConfig(config),
};
const wholeOf = (value: bigint) => Number(value / FIXED_ONE);
// The armies page says a lopsided fight hands its stamina back; it is wrong the day the config stops the refund.
if (!combatRules.stamina.damage_stamina_refund) throw new Error("Blitz no longer refunds a fight's stamina");

/**
 * The worked example: 1,000 Knights of each tier attack 1,000 T1 Knights on grassland (no biome edge for Knights), both
 * rested, no relics, resolved by the client's exchange, which reproduces the contract's recorded exchanges exactly.
 */
const EXAMPLE_TROOPS = 1_000;
// The moment of the example fight; each bar is settled then, at a T1 army's full stamina.
const FIGHT_AT = 1_000;
const TROOP_TIERS = ["T1", "T2", "T3"] as const;
const restedKnights = (tier: (typeof TROOP_TIERS)[number]): ExchangeTroops => ({
  category: "Knight",
  tier,
  count: BigInt(EXAMPLE_TROOPS) * BigInt(RESOURCE_PRECISION),
  stamina: { amount: BigInt(stamina.staminaKnightMax), settled_at: FIGHT_AT, remainder: 0 },
  boosts: {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_at: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_at: 0,
    incr_stamina_regen_percent_num: 0,
    incr_stamina_regen_seconds_left: 0,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_at: 0,
  },
  battle_cooldown_end: FIGHT_AT,
});
const exampleFight = (tier: (typeof TROOP_TIERS)[number]) => {
  const attacker = restedKnights(tier);
  const result = resolveExchange(
    attacker,
    restedKnights("T1"),
    {
      timestamp: FIGHT_AT,
      attackDistance: 1,
      attackerBiome: BiomeType.Grassland,
      defenderBiome: BiomeType.Grassland,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard: false,
      attackerRoll: 0,
      defenderRoll: 0,
    },
    combatRules,
  );
  if (result.ok === false) throw new Error(`The example fight is refused: ${result.refusal}`);
  const troops = (loss: bigint) => n(Number(loss / BigInt(RESOURCE_PRECISION)));
  return {
    tier,
    defendersLost: troops(result.defenderLoss),
    attackersLost: troops(result.attackerLoss),
    attackerWait: n(result.attacker.battle_cooldown_end - FIGHT_AT),
    staminaSpent: n(Number(attacker.stamina.amount - result.attacker.stamina.amount)),
  };
};

export const BLITZ = {
  game: {
    minutes: n(config.season.durationSeconds / 60),
    players: n(rule.MAX_BLITZ_ROSTER_PLAYERS),
    slotMinutes: n(BLITZ_SLOT_INTERVAL_SECONDS / 60),
    closeMinutes: n(BLITZ_SLOT_PREPARATION_SECONDS / 60),
    tickSeconds: n(tickSeconds),
  },
  realm: {
    wheat: startOf(RESOURCE.wheat),
    labor: startOf(RESOURCE.labor),
    wood: startOf(3),
    coal: startOf(2),
    copper: startOf(4),
    donkeys: startOf(RESOURCE.donkey),
    garrison: n(limit.startingGuard),
    reserve: startOf(26),
    laborPerSecond: n(config.resources.productionByComplexRecipeOutputs[RESOURCE.labor]),
    wheatPerFarm: n(config.resources.productionByComplexRecipeOutputs[RESOURCE.wheat]),
    levels: LEVELS.map((name, level) => ({
      name,
      plots: n(buildablePlotCount(level)),
      armies: n([limit.settlementArmies, limit.cityArmies, limit.kingdomArmies, limit.empireArmies][level]),
      guards: n(
        [limit.settlementGuardSlots, limit.cityGuardSlots, limit.kingdomGuardSlots, limit.empireGuardSlots][level],
      ),
      cap: n(
        [limit.settlementDeploymentCap, limit.cityDeploymentCap, limit.kingdomDeploymentCap, limit.empireDeploymentCap][
          level
        ],
      ),
    })),
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    t2: n(stamina.staminaKnightMax + CONTRACT.t2StaminaBonus),
    t3: n(stamina.staminaKnightMax + CONTRACT.t3StaminaBonus),
    start: n(stamina.staminaInitial),
    perTick: n(stamina.staminaGainPerTick),
    explore: n(stamina.staminaExploreStaminaCost),
    step: n(stamina.staminaTravelStaminaCost),
    biomeStep: n(stamina.staminaBonusValue),
    attack: n(stamina.staminaAttackReq),
    defense: n(stamina.staminaDefenseReq),
    rangedDefense: n(stamina.staminaDefenseReq / 2),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
  },
  troops: {
    strength: [limit.t1TierStrength, limit.t2TierStrength, limit.t3TierStrength].map(n),
    sizeModifier: [limit.t1TierModifier, limit.t2TierModifier, limit.t3TierModifier].map((value) => n(value / 100)),
    biomeBonus: `${n(config.troop.damage.damageBiomeBonusNum / 100)}%`,
    cooldownSeconds: n(config.battle.cooldownSeconds),
    guardRefillMinutes: n(limit.guardResurrectionDelay / 60),
    timerPenalty: `${100 - CONTRACT.battleTimerPenaltyPercent}%`,
    lowStaminaPenalty: `${100 - CONTRACT.lowStaminaTenths * 10}%`,
    knightAssault: `${CONTRACT.knightAssaultPercent - 100}%`,
    knightGuard: `${100 - CONTRACT.knightGuardPercent}%`,
    rangedOnArmies: `${CONTRACT.rangedOnArmiesPercent}%`,
    rangedOnGuards: `${CONTRACT.rangedOnGuardsPercent}%`,
    crossbowRange: n(CONTRACT.crossbowRange),
  },
  combat: {
    scale: n(wholeOf(combatRules.damage.damage_scaling_factor)),
    sizeExponent: n(CONTRACT.sizeExponentTenths / 10),
    tierWeights: [FIXED_ONE, combatRules.damage.t2_damage_multiplier, combatRules.damage.t3_damage_multiplier].map(
      (weight) => n(wholeOf(weight)),
    ),
    refundFrom: n(CONTRACT.timerRefundFloorRatio),
    refundFull: n(CONTRACT.timerRefundCeilingRatio),
    rangedWaitSeconds: n(Math.floor(config.battle.cooldownSeconds / 2)),
    exampleTroops: n(EXAMPLE_TROOPS),
    example: TROOP_TIERS.map(exampleFight),
  },
  map: {
    ringStep: n(ringStep),
    exploreCap: n(limit.exploreRewardStrengthCap),
    spireFind: pct(spireChance),
    spireEssence: n(CONTRACT.spireEssence),
    riftFind: pct(riftChance),
    campFind: pct(campChance),
    crateMinutes: n(exploration.relicDiscoveryIntervalSeconds / 60),
    crateHexes: n(exploration.relicHexDistanceFromCenter),
    relicMinutes: n((timedRelic.duration * tickSeconds) / 60),
    luckyCrate: `1 in ${n(10_000 / CONTRACT.luckyChestBps)}`,
    lightGuard: range(limit.lightGuardLowerBound, limit.lightGuardUpperBound),
    heavyGuard: range(limit.heavyGuardLowerBound, limit.heavyGuardUpperBound),
    riftPerSecond: n(config.mines.kinds[1].productionRate),
    // A rift's total output is its kind's minimum cap times one of `capSteps` draws (contracts mines.cairo `cap`).
    riftTotal:
      config.mines.kinds[1].capSteps === 1
        ? n(config.mines.kinds[1].capMinimum)
        : range(config.mines.kinds[1].capMinimum, config.mines.kinds[1].capMinimum * config.mines.kinds[1].capSteps),
    campLaborPerSecond: n(config.campLaborPerSecond),
    camp: {
      wheat: campStockOf(RESOURCE.wheat),
      labor: campStockOf(RESOURCE.labor),
      donkeys: campStockOf(RESOURCE.donkey),
    },
  },
  points: {
    tile: pointsOf(points.pointsForTileExploration),
    claim: pointsOf(points.pointsForNonHyperstructureClaimAgainstBandits),
    crate: pointsOf(points.pointsForRelicDiscovery),
    hyperstructure: pointsOf(points.pointsForHyperstructureClaimAgainstBandits),
    perRealmPerSecond: pointsOf(points.hyperstructurePointsPerCycle),
  },
  transport: {
    donkeyKg: n(Number(config.carryCapacityGram[2]) / 1000),
    deliveryMinutes: n(config.tick.deliveryTickIntervalInSeconds / 60),
  },
};
