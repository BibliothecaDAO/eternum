import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { seasonDayUnitSeconds } from "../../../../config/source/common/season-clock";
import {
  RELICS_PER_LAYER,
  previewRuinGuardBounds,
} from "../../../../contracts/l3/world-native/schema/site-previews.gen";
import {
  nativeFragmentConstants as fragments,
  nativeOathConstants as oaths,
  nativeRaceConstants as raceRules,
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { MAINNET_TOKENS } from "../../../../packages/chain/src/tokens";
import { logisticsStamina } from "../../../../packages/core/src/utils/attribute-tiers";
import { aspectMeaning, orderMeaning } from "../../../game/src/ui/design-system/icon-meaning";
import { buildingMeaning, RELIC_KINDS, relicMeaning } from "../../../game/src/ui/design-system/domain-icon-meaning";
import { ASPECT_PAGE_WORDS, RELIC_WORDS } from "../../../game/src/ui/design-system/kit/words";
import { oathEffectDescription } from "../../../game/src/ui/features/frontier/army/oath-details";
import { triumphHead, worldBaneHead } from "../../../game/src/ui/features/frontier/day/day-bane-face";
import { relicEffect } from "../../../game/src/ui/features/frontier/relics/relic-catalog";
import {
  ASPECT_REWARD,
  BuildingType,
  FRAGMENT_CENTS,
  FRAGMENT_SPEND_COMMANDS,
  FRAGMENTS_A_DAY,
  FRIEND_FRAGMENTS,
  FRIEND_GLORY,
  FRONTIER_BUILDING_TYPES,
  FRONTIER_TROOP_NAMES,
  LAYER_NAMES,
  MIN_FRAGMENTS,
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

const tickMinutes = config.tick.armiesTickIntervalInSeconds / 60;

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
const logisticsBonusValue = logisticsStamina(stamina.staminaKnightMax, rule.ATTRIBUTE_CAP);

const castleLevelLabel = (level: number) => `Level ${level + 1} (${rankName(level)})`;
const castleLevelInline = (level: number) => `castle level ${level + 1} (${rankName(level)})`;

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
  [research.SUPPLY_YARD]: { makes: "Logistics training", level: research.SUPPLY_YARD_LEVEL, order: 8 },
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

export const FRONTIER = {
  calendar: SEASON_ONE_CALENDAR,
  day: {
    shortestHours: hoursOf(SHORT_DAY_UNITS),
    daysPerBag: DAYS_PER_BAG,
    bagHours: hoursOf(UNITS_PER_BAG),
    lengths: dayLengthsList,
    seasonDays: n(racePreset.seasonDays),
  },
  realm: {
    troops: n(config.startingResources.find((r: { resource: number }) => r.resource === KNIGHT).amount),
    wheat: n(config.startingResources.find((r: { resource: number }) => r.resource === WHEAT).amount),
    labor: n(config.startingResources.find((r: { resource: number }) => r.resource === LABOR).amount),
    castleLevels: Array.from({ length: config.realmMaxLevel }, (_, level) => castleLevelLabel(level)),
    castleLevelInline: Array.from({ length: config.realmMaxLevel }, (_, level) => castleLevelInline(level)),
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
    castleLaborStep: n(CONTRACT.castleLaborStep),
    castleLaborRates: Array.from({ length: config.realmMaxLevel }, (_, level) =>
      perHour(config.resources.productionByComplexRecipeOutputs[LABOR] * CONTRACT.castleLaborStep ** level),
    ),
    rationStep: String(frontierPreset.board.rationStep),
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    perTick: n(stamina.staminaGainPerTick),
    tickMinutes: n(tickMinutes),
    fullHours: n(((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tickMinutes) / 60),
    reveal: n(stamina.staminaExploreStaminaCost),
    scoutReveal: n(rule.SCOUT_EXPLORE_STAMINA),
    step: n(stamina.staminaTravelStaminaCost),
    attack: n(stamina.staminaAttackReq),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
    well: `${n(rule.WELL_REFILL_PERCENT)}% of its maximum`,
    logisticsStep: `${n(rule.LOGISTICS_STEP_PERCENT)}%`,
    logisticsBonus: `+${n(logisticsBonusValue)}`,
    logisticsMax: n(stamina.staminaKnightMax + logisticsBonusValue),
    perFragment: n(fragments.STAMINA_PER_FRAGMENT),
  },
  discovery: {
    beasts: pct(frontierPreset.discovery.beastsBps),
    bandsPerHerd: n(rule.BEAST_BAND_SHARE / rule.BEAST_HERD_SHARE),
    camp: pct(frontierPreset.discovery.campBps),
    rift: pct(frontierPreset.discovery.riftBps),
    ruin: pct(frontierPreset.discovery.ruinBps),
    shrine: pct(frontierPreset.discovery.shrineBps),
    well: pct(frontierPreset.discovery.wellBps),
    emptyRevealLimit: n(frontierPreset.discovery.emptyRevealLimit),
    spireRevealLimit: n(rule.SPIRE_REVEAL_LIMIT),
    revealTroopCap: n(limit.exploreRewardStrengthCap),
  },
  sitePayouts: {
    campPercent: `${n(100 / CONTRACT.campGuardDivisor)}%`,
    riftPercent: `${n(100 * CONTRACT.riftGuardMultiplier)}%`,
    veilMultiplier: `${n(depthRewardPercent(1))}%`,
    hollowMultiplier: `${n(depthRewardPercent(2))}%`,
  },
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
  buildingsList: listAnd(frontierBuildings.map((building) => building.name)),
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
    list: dailyQuests.map((quest, index) => ({
      name: quest.name,
      objective: quest.objective,
      baseCount: n(questPreset.baseCounts[index]!),
    })),
  },
  banes: {
    chanceStep: `${n(banesPreset.chanceStep)}%`,
    quorum: `${n(banesPreset.quorumPercent)}%`,
    world: worldBanes.map((entry) => {
      const quest = baneQuests.find((q) => q.id === entry.quest);
      if (!quest) throw new Error(`Missing bane quest ${entry.quest}`);
      const head = worldBaneHead(entry.id, baneRules);
      return {
        name: head.name,
        icon: head.icon,
        effect: `${head.rule}.`,
        questName: quest.name,
        questObjective: quest.objective,
      };
    }),
    questNames: baneQuests.map((quest) => quest.name).join(", "),
  },
  deep: {
    mapSize: n(rule.DEEP_MAP_SIZE),
    gateDistance: n(deepPreset.gateDistance),
    guardSlots: n(rule.DEEP_GUARD_SLOTS),
    sitesPerRing: n(rule.DEEP_RING_SITES),
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
      return {
        name: site.name,
        troops: n(beast.count),
        weapon: beast.bow ? "Bow" : "Blade",
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
    rerollNote: `Spend ${n(fragments.OATH_REROLL_FRAGMENTS)} Fragments to replace one of the ${n(CONTRACT.oathDrawCount)} drawn cards once per draw on the ${personalLayersAnd}.`,
    vitriolLoss: n(oaths.VITRIOL_LOSS_PER_TICK),
    reflectionWell: `${n(oaths.REFLECTION_WELL_PERCENT)}%`,
    detectionLimit: n(oaths.DETECTION_EMPTY_REVEAL_LIMIT),
    rows: oathRows,
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
      : `Spending Fragments is turned off during the final testnet (${SEASON_ONE_CALENDAR.testnetDates} UTC) and remains turned off until enabled.`,
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
