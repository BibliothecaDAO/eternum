import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { seasonDayUnitSeconds } from "../../../../config/source/common/season-clock";
import {
  RELICS_PER_LAYER,
  previewRuinGuardBounds,
} from "../../../../contracts/l3/world-native/schema/site-previews.gen";
import {
  nativeBaneConstants as baneConstants,
  nativeFragmentConstants as fragments,
  nativeOathConstants as oaths,
  nativeQuestConstants as questRules,
  nativeRaceConstants as raceRules,
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { MAINNET_TOKENS } from "../../../../packages/chain/src/tokens";
import { logisticsStamina } from "../../../../packages/core/src/utils/attribute-tiers";
import { buildablePlotCount } from "../../../../packages/core/src/utils/castle-reach";
import {
  buildingCopyCost,
  buildingCopyMultiplier,
  isOnePerRealm,
  oathAttackStamina,
  oathDeepLossPerTick,
  oathFuryRefund,
  oathSitePay,
} from "@bibliothecadao/eternum";
import { forecastFight, type CombatRules, type ExchangeTroops } from "@bibliothecadao/eternum/combat-exchange";
import { aspectMeaning, orderMeaning } from "../../../game/src/ui/design-system/icon-meaning";
import {
  beastMeaning,
  buildingMeaning,
  RELIC_KINDS,
  relicMeaning,
} from "../../../game/src/ui/design-system/domain-icon-meaning";
import { ASPECT_PAGE_WORDS, RELIC_WORDS } from "../../../game/src/ui/design-system/kit/words";
import { oathEffectDescription, oathName } from "../../../game/src/ui/features/frontier/army/oath-details";
import { triumphHead, worldBaneHead } from "../../../game/src/ui/features/frontier/day/day-bane-face";
import { relicEffect } from "../../../game/src/ui/features/frontier/relics/relic-catalog";
import {
  ASPECT_REWARD,
  BiomeType,
  BuildingType,
  DEEP_BEASTS,
  FRAGMENT_CENTS,
  FRAGMENT_SPEND_COMMANDS,
  FRAGMENTS_A_DAY,
  FRIEND_FRAGMENTS,
  FRIEND_GLORY,
  FRONTIER_BUILDING_TYPES,
  FRONTIER_TROOP_NAMES,
  LAYER_NAMES,
  MIN_FRAGMENTS,
  RESOURCE_PRECISION,
  STORE_PRODUCTS,
  TIER_WORDS,
  TroopType,
  aspectLordsWorth,
  aspectName,
  aspects,
  baneQuests,
  beastOf,
  buildingName,
  dailyQuests,
  deepSites,
  getProducedResource,
  orders,
  ordersOfAspect,
  rankName,
  resourceName,
  worldBanes,
} from "@bibliothecadao/types";
import { ETERNUM_CONFIG } from "./config";
import { CONTRACT, depthRewardPercent } from "./contract-constants";
import { SEASON_ONE_CALENDAR } from "./season-calendar";

const frontierPreset = nativePresetForId(nativePresetIdFor("frontier"));
const config = ETERNUM_CONFIG("frontier");
const stamina = config.troop.stamina;
const limit = config.troop.limit;
const deepPreset = frontierPreset.deep!;
const racePreset = frontierPreset.race!;
const banesPreset = frontierPreset.banes!;
const questPreset = frontierPreset.dailyQuest!;

const n = (value: number) => value.toLocaleString("en-US");
const pct = (bps: number) => `${n(bps / 100)}%`;
const range = (lower: number, upper: number) => `${n(lower)}–${n(upper)}`;
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const perHour = (ratePerSecond: number) => n(Math.round(ratePerSecond * 3600));
const listAnd = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
const listOr = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}` : (items[0] ?? "");
const personalLayers = LAYER_NAMES.slice(0, 3);
const personalLayersAnd = listAnd(personalLayers);
const personalLayersOr = listOr(personalLayers);
const allPayTokens = listOr(Object.values(MAINNET_TOKENS).map((token) => token.symbol));
const swapPayTokens = listOr(
  Object.entries(MAINNET_TOKENS)
    .filter(([key]) => key !== "lords")
    .map(([, token]) => token.symbol),
);
const chestOdds = (chest: (typeof frontierPreset.depths)[number]["chest"]) =>
  Object.entries(chest)
    .filter(([, bps]) => bps > 0)
    .map(([key, bps]) => {
      const name = TIER_WORDS.find((word) => word.toLowerCase() === key);
      if (!name) throw new Error(`Missing TIER_WORDS entry for chest tier "${key}"`);
      return `${name} (${pct(bps)})`;
    })
    .join(", ");

const hoursOf = (units: number) => (units * seasonDayUnitSeconds(frontierPreset)) / 3600;

const SHORT_DAY_UNITS = 2;
const DAYS_PER_BAG = CONTRACT.daysPerBag;
const UNITS_PER_BAG = CONTRACT.unitsPerBag;
const dayLengthHours = Array.from({ length: DAYS_PER_BAG }, (_, index) => hoursOf(SHORT_DAY_UNITS + index));
const dayLengthsList = `${dayLengthHours.slice(0, -1).join(", ")}, and ${dayLengthHours.at(-1)}`;
const bagHoursValue = hoursOf(UNITS_PER_BAG);
const averageDayHours = bagHoursValue / DAYS_PER_BAG;
const seasonRealDays = Math.round((racePreset.seasonDays * averageDayHours) / 24);

const tickMinutes = config.tick.armiesTickIntervalInSeconds / 60;
const staminaPerHour = Math.round((stamina.staminaGainPerTick * 3600) / config.tick.armiesTickIntervalInSeconds);
const staminaPerMinute = Number(
  ((stamina.staminaGainPerTick * 60) / config.tick.armiesTickIntervalInSeconds).toFixed(2),
);

const KNIGHT = 26;
const WHEAT = 35;
const LABOR = 23;

const priceOf = (costs: readonly { resource: number; amount: number }[]) =>
  costs.map(({ resource, amount }) => `${n(amount)} ${resourceName(resource)}`).join(" + ");

const researchRow = (row: number) =>
  frontierPreset.research
    .filter((step) => step.row === row)
    .sort((a, b) => a.tier - b.tier)
    .map((step) => ({ essence: n(step.essenceCost), labor: n(step.laborCost) }));

const finishHeight = raceRules.STAGE_COUNT * racePreset.stageHeight;
type TriumphStage = keyof typeof ASPECT_PAGE_WORDS.triumph;
const triumphPercents: Record<TriumphStage, number> = {
  1: racePreset.clearMistPercent,
  2: racePreset.secondWindPercent,
  3: racePreset.paleMoonPercent,
  4: racePreset.spoilsPercent,
};
const triumphTable = (Object.entries(ASPECT_PAGE_WORDS.triumph) as [string, string][])
  .map(([stageKey]) => {
    const stage = Number(stageKey) as TriumphStage;
    const percent = triumphPercents[stage];
    if (percent === undefined) throw new Error(`Missing Triumph percent for stage ${stageKey}`);
    const head = triumphHead(stage, percent);
    return `Stage ${stage} (${n(racePreset.stageHeight * stage)} height) | ${head.name} | ${head.rule}.`;
  })
  .join("\n");

const baneRules = {
  beast_percent: banesPreset.beastPercent,
  stamina_percent: banesPreset.staminaPercent,
  production_percent: banesPreset.productionPercent,
};

const oathEffectBase = {
  attackStamina: stamina.staminaAttackReq,
  revealStamina: stamina.staminaExploreStaminaCost,
  maxStamina: stamina.staminaKnightMax,
  staminaPerSecond: stamina.staminaGainPerTick / config.tick.armiesTickIntervalInSeconds,
  deepLossPerTick: deepPreset.lossPerTick,
};

const aspectOrders = orders.filter((order) => order.aspect !== null);
const oathRows = aspectOrders.map((order) => ({
  name: order.orderName,
  icon: orderMeaning(order.orderId),
  aspect: aspectName(order.aspect!),
  effect: `${oathEffectDescription(order.orderId, oathEffectBase)}.`,
}));

const buildingRate = (id: BuildingType): string | null => {
  if (id === research.WORKSHOP) return perHour(frontierPreset.board.workshopRate);
  const produced = getProducedResource(id);
  if (produced === undefined) return null;
  const rate = config.resources.productionByComplexRecipeOutputs[produced];
  return rate > 0 ? perHour(rate) : null;
};

const commandEnabled = (name: keyof typeof nativeCommandBits) =>
  (frontierPreset.commandMask & BigInt(nativeCommandBits[name])) !== 0n;

const anySpendEnabled = FRAGMENT_SPEND_COMMANDS.some((name) => commandEnabled(name));
const barFragments = n(Math.ceil(stamina.staminaKnightMax / fragments.STAMINA_PER_FRAGMENT));
const logisticsStepValue = logisticsStamina(stamina.staminaKnightMax, 1);
const logisticsBonusValue = logisticsStamina(stamina.staminaKnightMax, rule.ATTRIBUTE_CAP);
const logisticsMaxValue = stamina.staminaKnightMax + logisticsBonusValue;

const castleLevelLabel = (level: number) => `Level ${level + 1} (${rankName(level)})`;
const castleLevelInline = (level: number) => `castle level ${level + 1} (${rankName(level)})`;

const copySurchargeBps = config.buildings.buildingFixedCostScalePercent;
const copyMultiplierLabel = (copyNumber: number) =>
  `${Number(buildingCopyMultiplier(copyNumber - 1, copySurchargeBps).toFixed(2))}x`;
const damageFactorValue = Number(BigInt(config.troop.damage.damageScalingFactor) / 2n ** 64n);
const combatBetaValue = (CONTRACT.combatBetaTenths / 10).toFixed(1);
const combatFormula = `round(${n(damageFactorValue)} × troops ÷ (both sides' troops)^${combatBetaValue})`;
const farmBaseLabor = config.buildings.simpleBuildingCost[research.FARM][0].amount;
const workshopBaseLabor = config.buildings.simpleBuildingCost[research.WORKSHOP][0].amount;
const barracksBaseLabor = config.buildings.simpleBuildingCost[research.BARRACKS][0].amount;
const startingLabor = config.startingResources.find((r: { resource: number }) => r.resource === LABOR).amount;
if (workshopBaseLabor + barracksBaseLabor + farmBaseLabor !== startingLabor) {
  throw new Error(
    `Starter buildings (${workshopBaseLabor + barracksBaseLabor + farmBaseLabor}) do not equal starting labor (${startingLabor})`,
  );
}
for (let level = 0; level < config.realmMaxLevel - 1; level += 1) {
  const upgradeCost = config.realmUpgradeCosts[level + 1][0].amount;
  const cap = frontierPreset.board.laborStoreCaps![level];
  if (cap < upgradeCost) throw new Error(`Level ${level + 1} labor cap (${cap}) cannot hold upgrade (${upgradeCost})`);
}
const repeatableIds: readonly BuildingType[] = FRONTIER_BUILDING_TYPES.filter((id) => !isOnePerRealm(id));
const copyCostGroups = new Map<number, string[]>();
for (const id of repeatableIds) {
  const base = config.buildings.simpleBuildingCost[id][0].amount;
  copyCostGroups.set(base, [...(copyCostGroups.get(base) ?? []), buildingName(id, true)]);
}
const copyCostsTable = [...copyCostGroups.entries()]
  .map(
    ([base, names]) =>
      `${names.join(", ")} | ${[1, 2, 3, 4, 5, 6].map((copy) => n(Math.floor(buildingCopyCost(base, copy - 1, copySurchargeBps)))).join(" | ")}`,
  )
  .join("\n");

const buildingMeta: Partial<Record<BuildingType, { makes: string; level: number; order: number }>> = {
  [research.FARM]: { makes: "Wheat", level: 0, order: 0 },
  [research.BARRACKS]: { makes: FRONTIER_TROOP_NAMES[TroopType.Knight], level: 0, order: 1 },
  [research.RANGE]: { makes: FRONTIER_TROOP_NAMES[TroopType.Crossbowman], level: research.RANGE_LEVEL, order: 2 },
  [research.SCOUTS_LODGE]: {
    makes: FRONTIER_TROOP_NAMES[TroopType.Paladin],
    level: research.SCOUTS_LODGE_LEVEL,
    order: 3,
  },
  [research.WORKSHOP]: { makes: "Labor", level: 0, order: 4 },
  [research.STOREROOM]: { makes: "Wheat and labor storage", level: research.STOREROOM_LEVEL, order: 5 },
  [research.CONSCRIPTION_CAMP]: { makes: "Faster troop training", level: research.CONSCRIPTION_CAMP_LEVEL, order: 6 },
  [research.RATIONS_DEPOT]: { makes: "Lower wheat cost to deploy", level: research.RATIONS_DEPOT_LEVEL, order: 7 },
  [research.SUPPLY_YARD]: { makes: "Max stamina (Logistics)", level: research.SUPPLY_YARD_LEVEL, order: 8 },
};

const frontierBuildings = [...FRONTIER_BUILDING_TYPES]
  .map((id) => {
    const meta = buildingMeta[id];
    if (!meta) throw new Error(`Missing Frontier building row for ${id}`);
    const rate = buildingRate(id);
    return {
      order: meta.order,
      name: buildingName(id, true),
      makes: rate ? `${meta.makes} (${rate}/h)` : meta.makes,
      icon: buildingMeaning(id, true),
      opens: castleLevelLabel(meta.level),
      price: priceOf(config.buildings.simpleBuildingCost[id]),
    };
  })
  .sort((a, b) => a.order - b.order);

const PRECISION = BigInt(RESOURCE_PRECISION);
const combatRules: CombatRules = {
  cooldownSeconds: config.battle.cooldownSeconds,
  tickSeconds: config.tick.armiesTickIntervalInSeconds,
  damage: {
    t1_damage_value: BigInt(config.troop.damage.t1DamageValue),
    t2_damage_multiplier: BigInt(config.troop.damage.t2DamageMultiplier),
    t3_damage_multiplier: BigInt(config.troop.damage.t3DamageMultiplier),
    damage_biome_bonus_num: config.troop.damage.damageBiomeBonusNum,
    damage_scaling_factor: BigInt(config.troop.damage.damageScalingFactor),
  },
  stamina: {
    stamina_gain_per_tick: stamina.staminaGainPerTick,
    stamina_initial: stamina.staminaInitial,
    stamina_bonus_value: 0,
    stamina_knight_max: stamina.staminaKnightMax,
    stamina_paladin_max: stamina.staminaPaladinMax,
    stamina_crossbowman_max: stamina.staminaCrossbowmanMax,
    stamina_attack_req: stamina.staminaAttackReq,
    stamina_defense_req: stamina.staminaDefenseReq,
    stamina_explore_wheat_cost: 0,
    stamina_explore_fish_cost: 0,
    stamina_travel_wheat_cost: 0,
    stamina_travel_fish_cost: 0,
    stamina_travel_stamina_cost: stamina.staminaTravelStaminaCost,
    stamina_explore_stamina_cost: stamina.staminaExploreStaminaCost,
    capture_stamina_refund: 0,
    damage_stamina_refund: stamina.damageStaminaRefund,
  },
};

const makeTroops = (category: ExchangeTroops["category"], count: number): ExchangeTroops => ({
  category,
  tier: "T1",
  count: BigInt(count) * PRECISION,
  stamina: { amount: BigInt(stamina.staminaInitial), settled_at: 0, remainder: 0 },
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
  battle_cooldown_end: 0,
});

const oathMask = (...ids: number[]) => ids.reduce((mask, id) => mask | (1 << (id - 1)), 0);

const runFight = (
  attackerCategory: ExchangeTroops["category"],
  attackerCount: number,
  defenderCategory: ExchangeTroops["category"],
  defenderCount: number,
  options: {
    defenderGuard?: boolean;
    attackerOaths?: number;
    defenderOaths?: number;
    twinCount?: number;
  } = {},
) => {
  const forecast = forecastFight(
    makeTroops(attackerCategory, attackerCount),
    makeTroops(defenderCategory, defenderCount),
    {
      timestamp: 0,
      attackerBiome: BiomeType.Grassland,
      defenderBiome: BiomeType.Grassland,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard: options.defenderGuard ?? false,
      attackerOaths: options.attackerOaths ?? 0,
      defenderOaths: options.defenderOaths ?? 0,
      attackerTwin: options.twinCount ? makeTroops(attackerCategory, options.twinCount) : null,
    },
    combatRules,
  );
  if (forecast.outcome === "refused") throw new Error(`Fight refused: ${forecast.refusal}`);
  return {
    outcome: forecast.outcome,
    wins: forecast.outcome === "wins",
    kept: Number(forecast.attacker.count / PRECISION),
    lost: Number(forecast.attackerLoss / PRECISION),
    exchanges: forecast.exchanges,
  };
};

const runWinningFight = (
  attackerCategory: ExchangeTroops["category"],
  attackerCount: number,
  defenderCategory: ExchangeTroops["category"],
  defenderCount: number,
) => {
  const result = runFight(attackerCategory, attackerCount, defenderCategory, defenderCount);
  if (!result.wins) {
    throw new Error(
      `${attackerCount} ${attackerCategory} did not clear ${defenderCount} ${defenderCategory} (${result.outcome})`,
    );
  }
  return result;
};

const formatKept = (result: ReturnType<typeof runFight>) => {
  if (result.wins) return n(result.kept);
  return result.outcome === "stalls" ? "Stalls" : "Loses";
};

const minKnightsToClear = (
  defenderCount: number,
  options: { defenderGuard?: boolean; attackerOaths?: number; defenderOaths?: number; twinCount?: number },
) => {
  const step = 100;
  let low = step;
  let high = 60_000;
  const winsAt = (count: number) =>
    runFight("Knight", count, "Knight", defenderCount, {
      defenderGuard: options.defenderGuard,
      attackerOaths: options.attackerOaths,
      defenderOaths: options.defenderOaths,
      twinCount: options.twinCount,
    }).wins;
  if (!winsAt(high)) throw new Error(`No Knight army up to ${high} clears ${defenderCount} Knights`);
  while (low < high) {
    const mid = Math.floor((low + high) / (2 * step)) * step;
    if (winsAt(mid)) high = mid;
    else low = mid + step;
  }
  return low;
};

const exampleMultiplier = 1.5;
const campMid = Math.round((frontierPreset.depths[0].siteGuardLower + frontierPreset.depths[0].siteGuardUpper) / 2);
const campAttacker = Math.round(campMid * exampleMultiplier);
const exampleCrossbows = runWinningFight("Crossbowman", campAttacker, "Knight", campMid);
const exampleKnights = runWinningFight("Knight", campAttacker, "Knight", campMid);

const markRow = (guardCount: number, bow: boolean) => {
  const send = Math.round(guardCount * exampleMultiplier);
  const defender: ExchangeTroops["category"] = bow ? "Crossbowman" : "Knight";
  return {
    target: `${n(guardCount)}, ${bow ? "Bow" : "Blade"}`,
    sent: n(send),
    knights: formatKept(runFight("Knight", send, defender, guardCount)),
    crossbows: formatKept(runFight("Crossbowman", send, defender, guardCount)),
    scouts: formatKept(runFight("Paladin", send, defender, guardCount)),
  };
};

const herdBps = Math.round(
  (frontierPreset.discovery.beastsBps * rule.BEAST_HERD_SHARE) / (rule.BEAST_HERD_SHARE + rule.BEAST_BAND_SHARE),
);
const bandBps = frontierPreset.discovery.beastsBps - herdBps;
const nothingBps =
  10_000 -
  frontierPreset.discovery.beastsBps -
  frontierPreset.discovery.campBps -
  frontierPreset.discovery.riftBps -
  frontierPreset.discovery.ruinBps -
  frontierPreset.discovery.shrineBps -
  frontierPreset.discovery.wellBps;

const deepCompass = ["North", "East", "South", "West"] as const;
const deepSitePays: Record<(typeof deepSites)[number]["key"], string> = {
  foundation: `${n(deepPreset.buildingPay.alone)} / ${n(deepPreset.buildingPay.pair)} / ${n(deepPreset.buildingPay.crowd)} hyperstructure height and Glory per tick`,
  core: `${n(deepPreset.corePerTick)} Essence per tick (no Glory)`,
  mine: `${n(deepPreset.minePerTick)} labor per tick (no Glory)`,
  altar: `${n(deepPreset.buildingPay.alone)} / ${n(deepPreset.buildingPay.pair)} / ${n(deepPreset.buildingPay.crowd)} bane bar charge and Glory per tick (triggers Team Bane at ${n(deepPreset.altarThreshold)})`,
};

const powerMask = oathMask(oaths.POWER);
const twinsMask = oathMask(oaths.TWINS);
const protectionMask = oathMask(oaths.PROTECTION);
const breakTarget = 10_000;
const twinsAllyCount = 5_000;
const holdTicks = 15;
const holdStart = 9000;
const holdBaseLoss = Number(oathDeepLossPerTick(0, BigInt(deepPreset.lossPerTick) * PRECISION) / PRECISION);
const holdVitriolLoss = Number(
  oathDeepLossPerTick(oathMask(oaths.VITRIOL), BigInt(deepPreset.lossPerTick) * PRECISION) / PRECISION,
);
const holdBaseRemaining = holdStart - holdTicks * holdBaseLoss;
const holdVitriolRemaining = holdStart - holdTicks * holdVitriolLoss;
const attackChainCount = 7;
const netAttackCost = (mask: number) => {
  const cost = oathAttackStamina(mask, stamina.staminaAttackReq);
  return cost - oathFuryRefund(mask, cost);
};
const baseAttackCost = netAttackCost(0);
const angerAttackCost = oathAttackStamina(oathMask(oaths.ANGER), stamina.staminaAttackReq);
const angerCost = netAttackCost(oathMask(oaths.ANGER));
const furyRefundBaseValue = oathFuryRefund(oathMask(oaths.FURY), stamina.staminaAttackReq);
const furyRefundAngerValue = oathFuryRefund(oathMask(oaths.FURY, oaths.ANGER), angerAttackCost);
const furyExampleAttacks = 3;
const skillExampleAfterValue = Math.floor(oaths.SKILL_BELOW_STAMINA / 2);
const baseFuryCost = netAttackCost(oathMask(oaths.FURY));
const angerFuryCost = netAttackCost(oathMask(oaths.ANGER, oaths.FURY));
const sitePayPct = (mask: number, clean: boolean) => Number(oathSitePay(mask, 1000n, clean)) / 10;
const ragePct = sitePayPct(oathMask(oaths.RAGE), true);
const perfectionPct = sitePayPct(oathMask(oaths.PERFECTION), true);
const ragePerfectionPct = sitePayPct(oathMask(oaths.RAGE, oaths.PERFECTION), true).toFixed(1);
const bladeDeepBeasts = deepSites
  .filter((site) => !deepPreset.beasts[site.key].bow)
  .map((site) => DEEP_BEASTS[site.key].name)
  .join(", ");
const bowDeepBeasts = deepSites
  .filter((site) => deepPreset.beasts[site.key].bow)
  .map((site) => DEEP_BEASTS[site.key].name)
  .join(", ");

const ruinFamilyRange = (depth: number) =>
  `${beastOf("ruin", depth).name} (${range(...previewRuinGuardBounds(depth + 1, depth))} to ${range(...previewRuinGuardBounds(depth + RELICS_PER_LAYER, depth))})`;

const beastFamilies = [
  {
    name: "Herd",
    icon: beastMeaning(beastOf("herd", 0).model),
    weapon: "Blade",
    bring: FRONTIER_TROOP_NAMES[TroopType.Crossbowman],
    pays: `Wheat (${n(CONTRACT.herdGuardMultiplier)}x starting guard)`,
    surface: `${beastOf("herd", 0).name} (${range(frontierPreset.depths[0].beastWeakLower, frontierPreset.depths[0].beastWeakUpper)})`,
    veil: `${beastOf("herd", 1).name} (${range(frontierPreset.depths[1].beastWeakLower, frontierPreset.depths[1].beastWeakUpper)})`,
    hollow: `${beastOf("herd", 2).name} (${range(frontierPreset.depths[2].beastWeakLower, frontierPreset.depths[2].beastWeakUpper)})`,
  },
  {
    name: "Band",
    icon: beastMeaning(beastOf("band", 0).model),
    weapon: "Bow",
    bring: FRONTIER_TROOP_NAMES[TroopType.Knight],
    pays: `Oath pick (${n(CONTRACT.oathDrawCount)} Oaths)`,
    surface: `${beastOf("band", 0).name} (${range(frontierPreset.depths[0].beastStrongLower, frontierPreset.depths[0].beastStrongUpper)})`,
    veil: `${beastOf("band", 1).name} (${range(frontierPreset.depths[1].beastStrongLower, frontierPreset.depths[1].beastStrongUpper)})`,
    hollow: `${beastOf("band", 2).name} (${range(frontierPreset.depths[2].beastStrongLower, frontierPreset.depths[2].beastStrongUpper)})`,
  },
  {
    name: "Camp",
    icon: beastMeaning(beastOf("camp", 0).model),
    weapon: "Blade",
    bring: FRONTIER_TROOP_NAMES[TroopType.Crossbowman],
    pays: `Labor (${n(100 / CONTRACT.campGuardDivisor)}% starting guard) + supply post`,
    surface: `${beastOf("camp", 0).name} (${range(frontierPreset.depths[0].siteGuardLower, frontierPreset.depths[0].siteGuardUpper)})`,
    veil: `${beastOf("camp", 1).name} (${range(frontierPreset.depths[1].siteGuardLower, frontierPreset.depths[1].siteGuardUpper)})`,
    hollow: `${beastOf("camp", 2).name} (${range(frontierPreset.depths[2].siteGuardLower, frontierPreset.depths[2].siteGuardUpper)})`,
  },
  {
    name: "Rift",
    icon: beastMeaning(beastOf("rift", 0).model),
    weapon: "Bow",
    bring: FRONTIER_TROOP_NAMES[TroopType.Knight],
    pays: `Essence (${n(100 * CONTRACT.riftGuardMultiplier)}% starting guard)`,
    surface: `${beastOf("rift", 0).name} (${range(frontierPreset.depths[0].riftGuardLower, frontierPreset.depths[0].riftGuardUpper)})`,
    veil: `${beastOf("rift", 1).name} (${range(frontierPreset.depths[1].riftGuardLower, frontierPreset.depths[1].riftGuardUpper)})`,
    hollow: `${beastOf("rift", 2).name} (${range(frontierPreset.depths[2].riftGuardLower, frontierPreset.depths[2].riftGuardUpper)})`,
  },
  {
    name: "Ruin",
    icon: beastMeaning(beastOf("ruin", 0).model),
    weapon: "Blade",
    bring: FRONTIER_TROOP_NAMES[TroopType.Crossbowman],
    pays: "1 relic or 1 Fragment cache",
    surface: ruinFamilyRange(0),
    veil: ruinFamilyRange(1),
    hollow: ruinFamilyRange(2),
  },
] as const;

export const FRONTIER = {
  calendar: SEASON_ONE_CALENDAR,
  day: {
    shortestHours: hoursOf(SHORT_DAY_UNITS),
    longestHours: dayLengthHours.at(-1)!,
    averageHours: averageDayHours,
    daysPerBag: DAYS_PER_BAG,
    bagHours: bagHoursValue,
    lengths: dayLengthsList,
    seasonDays: n(racePreset.seasonDays),
    seasonRealDays: n(seasonRealDays),
  },
  realm: {
    troops: n(config.startingResources.find((r: { resource: number }) => r.resource === KNIGHT).amount),
    wheat: n(config.startingResources.find((r: { resource: number }) => r.resource === WHEAT).amount),
    labor: n(config.startingResources.find((r: { resource: number }) => r.resource === LABOR).amount),
    firstMinuteSummary: `${buildingName(research.WORKSHOP, true)} (${n(workshopBaseLabor)}) + ${buildingName(research.BARRACKS, true)} (${n(barracksBaseLabor)}) + ${buildingName(research.FARM, true)} (${n(farmBaseLabor)}) = ${n(workshopBaseLabor + barracksBaseLabor + farmBaseLabor)} labor`,
    castleLevels: Array.from({ length: config.realmMaxLevel }, (_, level) => castleLevelLabel(level)),
    castleLevelInline: Array.from({ length: config.realmMaxLevel }, (_, level) => castleLevelInline(level)),
    maxLevel: n(config.realmMaxLevel),
    plots: Array.from({ length: config.realmMaxLevel }, (_, level) => n(buildablePlotCount(level))),
    armies: [limit.settlementArmies, limit.cityArmies, limit.kingdomArmies, limit.empireArmies].map(n),
    deployCaps: [
      limit.settlementDeploymentCap,
      limit.cityDeploymentCap,
      limit.kingdomDeploymentCap,
      limit.empireDeploymentCap,
    ].map(n),
    castleLabor: [1, 2, 3].map((level) => n(config.realmUpgradeCosts[level][0].amount)),
    demolitionRefund: pct(frontierPreset.board.demolitionRefundBps),
    deployWheat: n(config.resources.productionBySimpleRecipe[KNIGHT][0].amount),
    storage: frontierPreset.board.resourceStoreCaps.map(n),
    laborStorage: frontierPreset.board.laborStoreCaps!.map(n),
    storeroomLaborStorage: frontierPreset.board.laborStoreCaps!.map((cap) =>
      n(Math.round((cap * (10_000 + frontierPreset.board.storageStepBps)) / 10_000)),
    ),
    castleLaborStep: n(CONTRACT.castleLaborStep),
    castleLaborRates: Array.from({ length: config.realmMaxLevel }, (_, level) =>
      perHour(config.resources.productionByComplexRecipeOutputs[LABOR] * CONTRACT.castleLaborStep ** level),
    ),
    rationStep: String(frontierPreset.board.rationStep),
    copyMultipliers: [1, 2, 3, 4, 5, 6].map(copyMultiplierLabel).join(", "),
    copyCostsTable,
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    perTick: n(stamina.staminaGainPerTick),
    perMinute: `+${staminaPerMinute}/min`,
    tickMinutes: n(tickMinutes),
    fullHours: n(((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tickMinutes) / 60),
    day8h: n(stamina.staminaKnightMax + dayLengthHours[0]! * staminaPerHour),
    day24h: n(stamina.staminaKnightMax + dayLengthHours.at(-1)! * staminaPerHour),
    reveal: n(stamina.staminaExploreStaminaCost),
    scoutReveal: n(rule.SCOUT_EXPLORE_STAMINA),
    step: n(stamina.staminaTravelStaminaCost),
    attack: n(stamina.staminaAttackReq),
    defenseReq: n(stamina.staminaDefenseReq),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
    well: `${n(rule.WELL_REFILL_PERCENT)}% of its maximum`,
    wellBase: n(Math.round((stamina.staminaKnightMax * rule.WELL_REFILL_PERCENT) / 100)),
    wellReflection: n(Math.round((stamina.staminaKnightMax * oaths.REFLECTION_WELL_PERCENT) / 100)),
    wellLogisticsBase: n(Math.round((logisticsMaxValue * rule.WELL_REFILL_PERCENT) / 100)),
    wellLogisticsReflection: n(Math.round((logisticsMaxValue * oaths.REFLECTION_WELL_PERCENT) / 100)),
    logisticsStep: `${n(rule.LOGISTICS_STEP_PERCENT)}%`,
    logisticsStepAmount: `+${n(logisticsStepValue)}`,
    logisticsBonus: `+${n(logisticsBonusValue)}`,
    logisticsMax: n(logisticsMaxValue),
    perFragment: n(fragments.STAMINA_PER_FRAGMENT),
  },
  combat: {
    formula: combatFormula,
    damageFactor: n(damageFactorValue),
    beta: combatBetaValue,
    bladeDeepBeasts,
    bowDeepBeasts,
    exampleLabel: `${LAYER_NAMES[0]} ${beastOf("camp", 0).name} camp`,
    exampleRatio: `${exampleMultiplier}x`,
    exampleGuard: n(campMid),
    exampleSent: n(campAttacker),
    exampleCrossbowsKept: n(exampleCrossbows.kept),
    exampleCrossbowsLost: n(exampleCrossbows.lost),
    exampleCrossbowsExchanges: n(exampleCrossbows.exchanges),
    exampleKnightsKept: n(exampleKnights.kept),
    exampleKnightsLost: n(exampleKnights.lost),
    exampleKnightsExchanges: n(exampleKnights.exchanges),
    markRows: [markRow(campMid, false), markRow(campMid, true), markRow(10_000, false), markRow(10_000, true)],
  },
  discovery: {
    herd: pct(herdBps),
    band: pct(bandBps),
    beasts: pct(frontierPreset.discovery.beastsBps),
    bandsPerHerd: n(rule.BEAST_BAND_SHARE / rule.BEAST_HERD_SHARE),
    camp: pct(frontierPreset.discovery.campBps),
    rift: pct(frontierPreset.discovery.riftBps),
    ruin: pct(frontierPreset.discovery.ruinBps),
    shrine: pct(frontierPreset.discovery.shrineBps),
    well: pct(frontierPreset.discovery.wellBps),
    nothing: pct(nothingBps),
    emptyRevealLimit: n(frontierPreset.discovery.emptyRevealLimit),
    spireRevealLimit: n(rule.SPIRE_REVEAL_LIMIT),
    spireStep: `${n(100 / rule.SPIRE_REVEAL_LIMIT)}%`,
    revealTroopCap: n(limit.exploreRewardStrengthCap),
  },
  sitePayouts: {
    herdMultiplier: `${n(CONTRACT.herdGuardMultiplier)}x`,
    campPercent: `${n(100 / CONTRACT.campGuardDivisor)}%`,
    riftPercent: `${n(100 * CONTRACT.riftGuardMultiplier)}%`,
    veilMultiplier: `${n(depthRewardPercent(1))}%`,
    hollowMultiplier: `${n(depthRewardPercent(2))}%`,
  },
  beastFamiliesCount: n(beastFamilies.length),
  beastFamilies,
  layers: {
    personalAnd: personalLayersAnd,
    personalOr: personalLayersOr,
  },
  depths: frontierPreset.depths.map((depth, index) => ({
    name: LAYER_NAMES[index],
    revealPercent: `${depth.revealPercent}%`,
    campGuard: `${beastOf("camp", index).name} ${range(depth.siteGuardLower, depth.siteGuardUpper)}`,
    riftGuard: `${beastOf("rift", index).name} ${range(depth.riftGuardLower, depth.riftGuardUpper)}`,
    beastWeak: `${beastOf("herd", index).name} ${range(depth.beastWeakLower, depth.beastWeakUpper)}`,
    beastStrong: `${beastOf("band", index).name} ${range(depth.beastStrongLower, depth.beastStrongUpper)}`,
    ruinGuard: beastOf("ruin", index).name,
  })),
  ruinGuardTable: LAYER_NAMES.slice(0, 3).map((layer, depth) => {
    const cells = TIER_WORDS.slice(depth, depth + RELICS_PER_LAYER).map(
      (name, place) => `${name}: ${range(...previewRuinGuardBounds(depth + place + 1, depth))}`,
    );
    return { layer, low: cells[0], mid: cells[1], high: cells[2] };
  }),
  caches: {
    surface: `${fragments.SURFACE_CACHE_PERCENT}%`,
    veil: `${fragments.VEIL_CACHE_PERCENT}%`,
    hollow: `${fragments.HOLLOW_CACHE_PERCENT}%`,
    troopsPerFragment: n(fragments.CACHE_TROOPS_PER_FRAGMENT),
  },
  troops: {
    knight: FRONTIER_TROOP_NAMES[TroopType.Knight],
    crossbowman: FRONTIER_TROOP_NAMES[TroopType.Crossbowman],
    scout: FRONTIER_TROOP_NAMES[TroopType.Paladin],
  },
  buildingsCount: n(FRONTIER_BUILDING_TYPES.length),
  buildings: frontierBuildings,
  buildingIcons: {
    farm: buildingMeaning(research.FARM, true),
    workshop: buildingMeaning(research.WORKSHOP, true),
    storeroom: buildingMeaning(research.STOREROOM, true),
    conscriptionCamp: buildingMeaning(research.CONSCRIPTION_CAMP, true),
    rationsDepot: buildingMeaning(research.RATIONS_DEPOT, true),
    supplyYard: buildingMeaning(research.SUPPLY_YARD, true),
  },
  names: {
    farm: buildingName(research.FARM, true),
    barracks: buildingName(research.BARRACKS, true),
    range: buildingName(research.RANGE, true),
    scoutsLodge: buildingName(research.SCOUTS_LODGE, true),
    workshop: buildingName(research.WORKSHOP, true),
    storeroom: buildingName(research.STOREROOM, true),
    conscriptionCamp: buildingName(research.CONSCRIPTION_CAMP, true),
    rationsDepot: buildingName(research.RATIONS_DEPOT, true),
    supplyYard: buildingName(research.SUPPLY_YARD, true),
    deep: LAYER_NAMES[3],
  },
  storeroom: {
    opens: castleLevelInline(research.STOREROOM_LEVEL),
    storageStep: pct(frontierPreset.board.storageStepBps),
  },
  rangeOpens: castleLevelInline(research.RANGE_LEVEL),
  scoutsLodgeOpens: castleLevelInline(research.SCOUTS_LODGE_LEVEL),
  conscriptionOpens: castleLevelInline(research.CONSCRIPTION_CAMP_LEVEL),
  rationsOpens: castleLevelInline(research.RATIONS_DEPOT_LEVEL),
  supplyYardOpens: castleLevelInline(research.SUPPLY_YARD_LEVEL),
  research: {
    farm: researchRow(research.ROW_FARM),
    workshop: researchRow(research.ROW_WORKSHOP),
    conscription: researchRow(research.ROW_CONSCRIPTION),
    rations: researchRow(research.ROW_RATIONS),
    training: researchRow(research.ROW_SUPPLY_YARD),
    oathSlots: researchRow(research.ROW_KNIGHT_OATHS).map((step, index) => ({
      slot: `Slot ${n(research.OATH_SLOTS_BASE + index + 1)}`,
      essence: step.essence,
      labor: step.labor,
    })),
    oathSlotsSummary: researchRow(research.ROW_KNIGHT_OATHS)
      .map(
        ({ essence, labor }, index) =>
          `Slot ${n(research.OATH_SLOTS_BASE + index + 1)}: ${essence} Essence, ${labor} labor`,
      )
      .join("; "),
    lore: researchRow(research.ROW_LORE),
    outputStep: pct(frontierPreset.board.outputStepBps),
  },
  attributes: {
    lightDamageReduction: `${100 - rule.FRONTIER_LIGHT_DAMAGE_PERCENT}%`,
    knightGuardReduction: `${100 - rule.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT}%`,
  },
  quest: {
    count: n(dailyQuests.length),
    labor: n(questPreset.labor),
    essence: n(questPreset.essence),
    bonusPercent: `${n(questPreset.bonusPercent)}%`,
    wonderFragments: n(fragments.WONDER_QUEST_FRAGMENTS),
    levelStep: n(CONTRACT.questLevelStep),
    levelScale: Array.from(
      { length: config.realmMaxLevel },
      (_, level) => `${n(CONTRACT.questLevelStep ** level)}x at ${castleLevelInline(level)}`,
    ).join(", "),
    levels: Array.from({ length: config.realmMaxLevel }, (_, level) => {
      const mult = CONTRACT.questLevelStep ** level;
      const labor = questPreset.labor * mult;
      const essence = questPreset.essence * mult;
      const bonusLabor = Math.round((labor * questPreset.bonusPercent) / 100);
      return {
        level: castleLevelLabel(level),
        base: `${n(labor)} labor + ${n(essence)} Essence`,
        bonusLabor: `${n(bonusLabor)} labor`,
      };
    }),
    list: dailyQuests.map((quest, index) => ({
      name: quest.name,
      objective: quest.objective,
      baseCount: n(questPreset.baseCounts[index]!),
    })),
  },
  banes: {
    count: n(baneQuests.length),
    chanceStep: `${n(banesPreset.chanceStep)}%`,
    quorum: `${n(banesPreset.quorumPercent)}%`,
    productionBaneName: worldBaneHead(baneConstants.ASH_FALL, baneRules).name,
    world: worldBanes.map((entry) => {
      const quest = baneQuests.find((q) => q.id === entry.quest);
      if (!quest) throw new Error(`Missing bane quest ${entry.quest}`);
      const head = worldBaneHead(entry.id, baneRules);
      const offset = (entry.quest - questRules.STAND) * config.realmMaxLevel;
      const targets = banesPreset.questCounts.slice(offset, offset + config.realmMaxLevel).map(n);
      return {
        name: head.name,
        icon: head.icon,
        effect: `${head.rule}.`,
        questName: quest.name,
        questObjective: quest.objective,
        targets: targets.join(" / "),
      };
    }),
    questNames: baneQuests.map((quest) => quest.name).join(", "),
  },
  deep: {
    mapSize: n(rule.DEEP_MAP_SIZE),
    gateDistance: n(deepPreset.gateDistance),
    gates: aspects.map((aspect, index) => `${aspect.name} (${deepCompass[index]})`).join(", "),
    guardSlots: n(rule.DEEP_GUARD_SLOTS),
    sitesPerRing: n(rule.DEEP_RING_SITES),
    randomSitesPerRing: n(rule.DEEP_RING_SITES - deepSites.length),
    maxSameKindPerRing: n(1 + (rule.DEEP_RING_SITES - deepSites.length)),
    sitesTotal: n(deepPreset.rings.length * rule.DEEP_RING_SITES),
    lossPerTick: n(deepPreset.lossPerTick),
    corePerTick: n(deepPreset.corePerTick),
    minePerTick: n(deepPreset.minePerTick),
    payAlone: n(deepPreset.buildingPay.alone),
    payPair: n(deepPreset.buildingPay.pair),
    payCrowd: n(deepPreset.buildingPay.crowd),
    altarThreshold: n(deepPreset.altarThreshold),
    ringsCount: n(deepPreset.rings.length),
    sitesCount: n(deepSites.length),
    rings: deepPreset.rings.map((ring, index) => ({
      number: index + 1,
      radius: n(ring.radius),
      realms: n(ring.realms),
    })),
    sites: deepSites.map((site) => {
      const beast = deepPreset.beasts[site.key];
      const deepBeast = DEEP_BEASTS[site.key];
      return {
        name: site.name,
        beastName: deepBeast.name,
        beastIcon: beastMeaning(deepBeast.model),
        troops: n(beast.count),
        weapon: beast.bow ? "Bow" : "Blade",
        bring: beast.bow ? FRONTIER_TROOP_NAMES[TroopType.Knight] : FRONTIER_TROOP_NAMES[TroopType.Crossbowman],
        pays: deepSitePays[site.key],
      };
    }),
  },
  aspectsCount: n(aspects.length),
  aspects: aspects.map((aspect) => ({
    name: aspect.name,
    icon: aspectMeaning(aspect.id),
    orders: ordersOfAspect(aspect.id).map((order) => ({
      name: order.orderName,
      icon: orderMeaning(order.orderId),
    })),
  })),
  race: {
    stages: n(raceRules.STAGE_COUNT),
    stageHeight: n(racePreset.stageHeight),
    finishHeight: n(finishHeight),
    lordsPerHeight: n(ASPECT_REWARD.lordsPerHeight),
    finishBonus: n(ASPECT_REWARD.finishBonus),
    maxFinishLords: n(aspectLordsWorth(finishHeight, true)),
    maxSeasonLords: n(aspects.length * aspectLordsWorth(finishHeight, false) + ASPECT_REWARD.finishBonus),
    gloryToShare: n(ASPECT_REWARD.gloryToShare),
    triumphTable,
  },
  oaths: {
    count: n(oathRows.length),
    drawCount: n(CONTRACT.oathDrawCount),
    baseSlots: n(research.OATH_SLOTS_BASE),
    extraSlots: n(research.OATH_SLOTS_STEPS),
    maxSlots: n(research.OATH_SLOTS_BASE + research.OATH_SLOTS_STEPS),
    passStamina: n(oaths.PASS_STAMINA),
    rerollFragments: n(fragments.OATH_REROLL_FRAGMENTS),
    rerollNote: `Spend ${n(fragments.OATH_REROLL_FRAGMENTS)} Fragments to reroll one offered Oath once per pick on the ${personalLayersAnd}.`,
    vitriolLoss: n(oaths.VITRIOL_LOSS_PER_TICK),
    reflectionWell: `${n(oaths.REFLECTION_WELL_PERCENT)}%`,
    detectionLimit: n(oaths.DETECTION_EMPTY_REVEAL_LIMIT),
    angerAttack: n(angerAttackCost),
    furyPercent: `${n(oaths.FURY_REFUND_PERCENT)}%`,
    furyRefundBase: n(furyRefundBaseValue),
    furyRefundAnger: n(furyRefundAngerValue),
    furyExampleAttacks: n(furyExampleAttacks),
    furyExampleTotal: n(furyExampleAttacks * stamina.staminaAttackReq),
    furyExampleWrong: n(furyExampleAttacks * furyRefundBaseValue),
    skillThreshold: n(oaths.SKILL_BELOW_STAMINA),
    skillDamagePercent: `+${n(oaths.SKILL_DAMAGE_PERCENT)}%`,
    skillExampleStart: n(stamina.staminaAttackReq + skillExampleAfterValue),
    skillExampleAfter: n(skillExampleAfterValue),
    skillExampleEnd: n(skillExampleAfterValue + furyRefundBaseValue),
    twinsPercent: `${n(oaths.TWINS_DAMAGE_PERCENT)}%`,
    titansBonus: `+${n(oaths.TITANS_STAMINA)}`,
    titansBaseMax: n(stamina.staminaKnightMax + oaths.TITANS_STAMINA),
    titansLogisticsMax: n(logisticsMaxValue + oaths.TITANS_STAMINA),
    bandSummary: `${beastOf("band", 0).name} ${range(frontierPreset.depths[0].beastStrongLower, frontierPreset.depths[0].beastStrongUpper)}, ${beastOf("band", 1).name} ${range(frontierPreset.depths[1].beastStrongLower, frontierPreset.depths[1].beastStrongUpper)}, ${beastOf("band", 2).name} ${range(frontierPreset.depths[2].beastStrongLower, frontierPreset.depths[2].beastStrongUpper)}`,
    rows: oathRows,
    pairs: [
      {
        job: `Clear ${n(breakTarget)} ${FRONTIER_TROOP_NAMES[TroopType.Knight]} guarding a Deep site (attacking ${FRONTIER_TROOP_NAMES[TroopType.Knight]}; ${oathName(oaths.TWINS)} uses a ${n(twinsAllyCount)}-troop adjacent own army that takes 0 losses)`,
        none: `${n(minKnightsToClear(breakTarget, { defenderGuard: true }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        first: `${oathName(oaths.POWER)}: ${n(minKnightsToClear(breakTarget, { defenderGuard: true, attackerOaths: powerMask }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        second: `${oathName(oaths.TWINS)}: ${n(minKnightsToClear(breakTarget, { defenderGuard: true, attackerOaths: twinsMask, twinCount: twinsAllyCount }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        both: `${n(
          minKnightsToClear(breakTarget, {
            defenderGuard: true,
            attackerOaths: powerMask | twinsMask,
            twinCount: twinsAllyCount,
          }),
        )} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
      },
      {
        job: `Hold a Deep site with ${n(holdStart)} ${FRONTIER_TROOP_NAMES[TroopType.Knight]} after ${holdTicks} ticks (rival ${FRONTIER_TROOP_NAMES[TroopType.Knight]} needed to clear)`,
        none: `${n(minKnightsToClear(holdBaseRemaining, { defenderGuard: true }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        first: `${oathName(oaths.PROTECTION)}: ${n(minKnightsToClear(holdBaseRemaining, { defenderGuard: true, defenderOaths: protectionMask }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        second: `${oathName(oaths.VITRIOL)}: ${n(minKnightsToClear(holdVitriolRemaining, { defenderGuard: true }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
        both: `${n(minKnightsToClear(holdVitriolRemaining, { defenderGuard: true, defenderOaths: protectionMask }))} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`,
      },
      {
        job: `Stamina spent across ${attackChainCount} won attacks`,
        none: `${n(attackChainCount * baseAttackCost)} stamina`,
        first: `${oathName(oaths.ANGER)}: ${n(attackChainCount * angerCost)} stamina`,
        second: `${oathName(oaths.FURY)}: ${n(attackChainCount * baseFuryCost)} stamina`,
        both: `${n(attackChainCount * angerFuryCost)} stamina`,
      },
      {
        job: `Cleared-site payout on a clean win (<${n(oaths.PERFECTION_LOSS_PERCENT)}% lost)`,
        none: `${n(sitePayPct(0, true))}%`,
        first: `${oathName(oaths.RAGE)}: ${n(ragePct)}%`,
        second: `${oathName(oaths.PERFECTION)}: ${n(perfectionPct)}%`,
        both: `${ragePerfectionPct}%`,
      },
    ],
  },
  relics: {
    count: n(RELIC_KINDS.length),
    tiersCount: n(TIER_WORDS.length),
    firstTier: TIER_WORDS[0],
    lastTier: TIER_WORDS[TIER_WORDS.length - 1],
    slots: n(CONTRACT.armyRelicSlots),
    minutesPerTier: n(CONTRACT.relicSecondsPerRank / 60),
    maxMinutes: n((CONTRACT.relicSecondsPerRank * rule.ATTRIBUTE_CAP) / 60),
    rows: RELIC_KINDS.map((kind) => ({
      name: RELIC_WORDS.kinds[kind],
      icon: relicMeaning(kind),
      common: relicEffect({ kind, rank: 1 }, oathEffectBase),
      legendary: relicEffect({ kind, rank: rule.ATTRIBUTE_CAP }, oathEffectBase),
    })),
    layerOdds: frontierPreset.depths.map((depth, index) => ({
      layer: LAYER_NAMES[index],
      odds: chestOdds(depth.chest),
    })),
  },
  shop: {
    payTokens: allPayTokens,
    lordsNote: `The Shop takes ${MAINNET_TOKENS.lords.symbol} (or swaps ${swapPayTokens} into ${MAINNET_TOKENS.lords.symbol} through AVNU) for Fragments.`,
    statusNote: anySpendEnabled
      ? "Spending Fragments is on."
      : `Spending Fragments is turned off during the final testnet (${SEASON_ONE_CALENDAR.testnetDates} UTC).`,
    sealRule: `Lasts the whole season. Gives ${n(questPreset.bonusPercent)}% daily quest labor and the Season 1 Realm skin. You can also get the Seal with a code.`,
    staminaRule: `Refills ${n(fragments.STAMINA_PER_FRAGMENT)} stamina per Fragment on the ${personalLayersAnd} (${barFragments} Fragments for a full ${n(stamina.staminaKnightMax)} bar). Does not work inside the ${LAYER_NAMES[3]}.`,
    fragmentPrice: dollars(FRAGMENT_CENTS),
    minFragments: n(MIN_FRAGMENTS),
    dailyCap: n(FRAGMENTS_A_DAY),
    sealFragments: n(fragments.SEAL_FRAGMENTS),
    packs: Object.values(STORE_PRODUCTS).map((pack) => ({
      fragments: n(pack.fragments),
      price: dollars(pack.cents),
    })),
    friendGlory: n(FRIEND_GLORY),
    friendFragments: n(FRIEND_FRAGMENTS),
  },
};
